#!/usr/bin/env python3
"""Create/update a same-repository PR. No commit, checkout, force push or CI polling."""

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile


class Failure(Exception):
    pass


def run(*args, allowed=(0,)):
    # Keep inherited proxy/auth settings. Never evaluate arguments in a shell.
    result = subprocess.run(args, text=True, encoding="utf-8", capture_output=True)
    if result.returncode not in allowed:
        # Client diagnostics can include credential-bearing remote URLs; do not echo them.
        operation = " ".join(args[:3] if args[0] == "gh" else args[:2])
        raise Failure(f"{operation} が失敗しました (exit {result.returncode})。"
                      "認証・通信・権限・ブランチ保護を確認してください。自動再試行はしません。")
    return result


def git(*args, **kwargs):
    return run("git", *args, **kwargs)


def validate_branch(value):
    if value.startswith("-") or value.startswith("refs/"):
        raise Failure("ブランチは refs/ やオプションではなく短い名前で指定してください。")
    git("check-ref-format", "refs/heads/" + value)


def repository():
    fetch_url = git("remote", "get-url", "origin").stdout.strip()
    push_urls = git("remote", "get-url", "--push", "--all", "origin").stdout.splitlines()

    def parse(url):
        match = re.fullmatch(
            r"(?:https://github\.com/|git@github\.com:|ssh://git@github\.com/)"
            r"([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+?)(?:\.git)?/?", url)
        if not match:
            raise Failure("origin は認証情報を含まない github.com の HTTPS/SSH URL が必要です。")
        return match[1]

    repo = parse(fetch_url)
    if len(push_urls) != 1 or parse(push_urls[0]).lower() != repo.lower():
        raise Failure("origin の取得先と push 先が一致しません。設定を確認してください。")
    if git("config", "--bool", "--get", "remote.origin.mirror", allowed=(0, 1)).stdout.strip() == "true":
        raise Failure("mirror リモートには push できません。")
    return "github.com/" + repo


def remote_tip(branch, required=False):
    result = git("ls-remote", "--exit-code", "--heads", "origin", "refs/heads/" + branch,
                 allowed=(0, 2))
    if result.returncode == 2:
        if required:
            raise Failure(f"リモートにベースブランチ {branch} がありません。代替は選択しません。")
        return None
    lines = result.stdout.splitlines()
    exact = [line.split()[0] for line in lines
             if len(line.split()) == 2 and line.split()[1] == "refs/heads/" + branch]
    if len(exact) != 1:
        raise Failure("リモートブランチを一意に確認できません。")
    return exact[0]


def fetch_tip(branch):
    git("fetch", "--no-tags", "origin", "refs/heads/" + branch)
    return git("rev-parse", "--verify", "FETCH_HEAD^{commit}").stdout.strip()


def validate_body(path, ticket):
    body = path.read_text(encoding="utf-8")
    template = Path(__file__).resolve().parents[1] / "pr-body-template.md"
    headings = re.findall(r"^## .+$", template.read_text(encoding="utf-8"), re.M)
    if re.findall(r"^## .+$", body, re.M) != headings or not body.startswith(headings[0] + "\n"):
        raise Failure("本文はスキル内テンプレートの6見出し・順序に従ってください。")
    sections = re.split(r"^## .+\n", body, flags=re.M)[1:]
    if any(not section.strip() for section in sections) or re.search(r"\{\{.+?\}\}", body):
        raise Failure("本文の空欄・テンプレート変数を埋めてください。未実施は明記してください。")
    if f"[{ticket}](https://magu.atlassian.net/browse/{ticket})" not in sections[0]:
        raise Failure("対象チケット欄に指定した Jira 番号とリンクが必要です。")
    return body


def existing_pr(repo, source, base):
    result = run("gh", "pr", "list", "--repo", repo, "--state", "open", "--head", source,
                 "--base", base, "--limit", "100", "--json",
                 "number,url,headRefName,baseRefName,isCrossRepository")
    prs = json.loads(result.stdout)
    matches = [pr for pr in prs if pr["headRefName"] == source and pr["baseRefName"] == base
               and pr["isCrossRepository"] is False]
    if len(matches) > 1 or len(prs) == 100:
        raise Failure("既存 PR を一意に確認できません。新規作成を停止します。")
    return matches[0] if matches else None


def execute(args):
    validate_branch(args.source)
    validate_branch(args.base)
    if args.source == args.base:
        raise Failure("作成元とベースには異なるブランチを指定してください。")
    if args.base == "main" and not args.confirm_main:
        raise Failure("main 向け PR はユーザー確認が必要です。確認後のみ --confirm-main を指定してください。")
    if not re.fullmatch(r"CHRON-[1-9][0-9]*", args.ticket):
        raise Failure("確定した CHRON チケット番号を指定してください。")
    if not args.title.strip() or "\n" in args.title or args.title.startswith("-"):
        raise Failure("PR 件名には空でない1行の件名を指定してください。")
    body = validate_body(args.body_file, args.ticket)
    root = git("rev-parse", "--show-toplevel").stdout.strip()
    os.chdir(root)
    source_ref = "refs/heads/" + args.source
    source_sha = git("rev-parse", "--verify", source_ref + "^{commit}").stdout.strip()
    repo = repository()
    run("gh", "auth", "status", "--hostname", "github.com")
    if git("status", "--porcelain").stdout:
        print("注意: 未コミット変更は PR に含めません。コミット・stash・checkout は行いません。", file=sys.stderr)
    remote_tip(args.base, required=True)
    base_sha = fetch_tip(args.base)
    source_remote = remote_tip(args.source)
    if source_remote:
        source_remote = fetch_tip(args.source)
        if git("merge-base", "--is-ancestor", source_remote, source_sha, allowed=(0, 1)).returncode:
            raise Failure("作成元ブランチがリモートより遅れているか分岐しています。force push はしません。")
    if git("diff", "--quiet", base_sha + "..." + source_sha, allowed=(0, 1)).returncode == 0:
        raise Failure("ベースに対する変更差分がありません。")
    pr = existing_pr(repo, args.source, args.base)
    needs_push = source_remote != source_sha
    if args.dry_run:
        print(json.dumps({"repo": repo, "source": args.source, "base": args.base,
                          "ticket": args.ticket, "push": needs_push,
                          "action": "update" if pr else "create",
                          "url": pr["url"] if pr else None}, ensure_ascii=False))
        return
    if needs_push:
        # A pinned commit and explicit destination avoid checkout and push-default surprises.
        git("push", "--no-follow-tags", "origin", source_sha + ":" + source_ref)
    if remote_tip(args.source) != source_sha:
        raise Failure("push 後のリモート先端が対象コミットと一致しません。PR 操作を停止します。")
    # Recheck just before writing: another invocation might have created a PR during push.
    pr = existing_pr(repo, args.source, args.base)
    with tempfile.TemporaryDirectory(prefix="chronolist-pr-") as directory:
        body_path = Path(directory) / "body.md"
        body_path.write_text(body, encoding="utf-8")
        if pr:
            run("gh", "pr", "edit", str(pr["number"]), "--repo", repo,
                "--body-file", str(body_path))
            print(pr["url"])
        else:
            result = run("gh", "pr", "create", "--repo", repo, "--head", args.source,
                         "--base", args.base, "--title", args.title, "--body-file", str(body_path))
            print(result.stdout.strip())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", help="ローカルの作成元ブランチ（必須）")
    parser.add_argument("--base", default="develop")
    parser.add_argument("--ticket", required=True, help="エージェントが確定した CHRON チケット番号")
    parser.add_argument("--title", required=True)
    parser.add_argument("--body-file", type=Path, required=True)
    parser.add_argument("--confirm-main", action="store_true", help="今回の main 指定についてユーザー確認済み")
    parser.add_argument("--dry-run", action="store_true", help="fetch と参照だけ行い、push・PR 書き込みをしない")
    args = parser.parse_args()
    try:
        execute(args)
    except (Failure, OSError, ValueError, KeyError, TypeError) as error:
        print(f"停止: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
