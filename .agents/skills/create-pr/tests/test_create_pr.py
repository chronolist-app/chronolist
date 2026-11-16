"""Real local Git operations with a mocked process boundary. Never contacts GitHub."""

from contextlib import redirect_stderr, redirect_stdout
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


SKILL = Path(__file__).resolve().parents[1]
SCRIPT = SKILL / "scripts/create_pr.py"
REAL_GIT = shutil.which("git")
REAL_RUN = subprocess.run
SPEC = importlib.util.spec_from_file_location("create_pr", SCRIPT)
CREATE_PR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CREATE_PR)


class CreatePrTests(unittest.TestCase):
    def setUp(self):
        if REAL_GIT is None:
            self.skipTest("Git is required for the local integration tests")
        self.original_cwd = Path.cwd()
        self.temp = tempfile.TemporaryDirectory(prefix="chronolist-pr-test-")
        self.addCleanup(self.cleanup_workspace)
        self.root = Path(self.temp.name)
        # Non-ASCII paths exercise subprocess output decoding as well as file I/O.
        self.repo = self.root / "作業リポジトリ"
        self.remote = self.root / "remote.git"
        self.repo.mkdir()
        self.state = {}
        self.entries = []
        self.env = dict(os.environ)
        for key in list(self.env):
            if key.startswith(("GIT_", "GH_", "GITHUB_")):
                del self.env[key]
        self.env.update({"GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull,
                         "GIT_TERMINAL_PROMPT": "0", "GIT_ALLOW_PROTOCOL": "file"})
        self.git("init", "--bare", str(self.remote))
        self.git("init", "-b", "develop")
        self.git("config", "user.name", "Test")
        self.git("config", "user.email", "test@example.invalid")
        self.git("config", "commit.gpgsign", "false")
        self.git("config", "core.autocrlf", "false")
        (self.repo / "base.txt").write_text("base\n", encoding="utf-8")
        self.git("add", "base.txt")
        self.git("commit", "-m", "initial")
        self.git("remote", "add", "origin", str(self.remote))
        self.git("push", "origin", "develop")
        self.git("branch", "main")
        self.git("push", "origin", "main")
        self.source = "feature/CHRON-196"
        self.git("checkout", "-b", self.source)
        (self.repo / "change.txt").write_text("change\n", encoding="utf-8")
        self.git("add", "change.txt")
        self.git("commit", "-m", "変更を追加")
        self.body = self.root / "本文.md"
        self.body.write_text((SKILL / "pr-body-template.md").read_text(encoding="utf-8")
                             .replace("{{TICKET}}", "CHRON-196")
                             .replace("{{SUMMARY}}", "開発ガイドを追加")
                             .replace("{{CHANGES}}", "共通ルールを整備")
                             .replace("{{NOTES}}", "補足なし"), encoding="utf-8")

    def cleanup_workspace(self):
        # Restore cwd before removing anything; Windows refuses to delete an active cwd.
        os.chdir(self.original_cwd)
        self.temp.cleanup()

    def git(self, *args, cwd=None):
        result = REAL_RUN([REAL_GIT, *args], cwd=cwd or self.repo, env=self.env,
                          capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip()

    def configure(self, **values):
        self.state = values

    def command(self, argv, **kwargs):
        """Intercept gh entirely; delegate permitted Git commands to the local repository."""
        tool, *args = argv
        entry = {"tool": tool, "args": args}
        if "--body-file" in args:
            entry["body"] = Path(args[args.index("--body-file") + 1]).read_text(encoding="utf-8")
        self.entries.append(entry)

        def result(code=0, stdout=""):
            return subprocess.CompletedProcess(argv, code, stdout, "")

        if tool == "git":
            if args[:2] == ["remote", "get-url"]:
                key = "push_url" if "--push" in args else "fetch_url"
                return result(stdout=self.state.get(key, "https://github.com/test/chronolist.git") + "\n")
            if args and self.state.get(args[0] + "_fail"):
                return result(1)
            # The real origin is always a temporary bare repository. GIT_ALLOW_PROTOCOL
            # additionally prevents accidental network access through a future code path.
            return REAL_RUN([REAL_GIT, *args], **kwargs)
        self.assertEqual(tool, "gh", "Unexpected external tool")
        if self.state.get("missing_gh"):
            raise FileNotFoundError("gh is unavailable")
        if args[:2] == ["auth", "status"]:
            return result(1 if self.state.get("auth_fail") else 0)
        if args[:2] == ["pr", "list"]:
            if self.state.get("list_fail"):
                return result(1)
            return result(stdout="not JSON" if self.state.get("bad_json")
                          else json.dumps(self.state.get("prs", [])))
        if args[:2] in (["pr", "create"], ["pr", "edit"]):
            if self.state.get(args[1] + "_fail"):
                return result(1)
            return result(stdout="https://github.com/test/chronolist/pull/7\n")
        self.fail("Unexpected gh command (including CI polling)")

    def invoke(self, *extra, source=None, ok=True):
        argv = [str(SCRIPT), source or self.source,
                "--ticket", "CHRON-196", "--title", "開発ガイドを整備",
                "--body-file", str(self.body), *extra]
        stdout, stderr = io.StringIO(), io.StringIO()
        previous_cwd = Path.cwd()
        try:
            os.chdir(self.repo)
            with patch.dict(os.environ, self.env, clear=True), patch.object(sys, "argv", argv), \
                    patch.object(CREATE_PR.subprocess, "run", side_effect=self.command), \
                    redirect_stdout(stdout), redirect_stderr(stderr):
                code = CREATE_PR.main()
        finally:
            os.chdir(previous_cwd)
        result = subprocess.CompletedProcess(argv, code, stdout.getvalue(), stderr.getvalue())
        self.assertEqual(result.returncode, 0 if ok else 1, result.stdout + result.stderr)
        return result

    def calls(self, tool=None, verb=None):
        return [entry for entry in self.entries if (tool is None or entry["tool"] == tool)
                and (verb is None or entry["args"][:len(verb)] == verb)]

    def assert_no_writes(self):
        self.assertFalse(self.calls("git", ["push"]))
        self.assertFalse(self.calls("gh", ["pr", "create"]))
        self.assertFalse(self.calls("gh", ["pr", "edit"]))

    def pr(self, **values):
        return dict(number=7, url="https://github.com/test/chronolist/pull/7",
                    headRefName=self.source, baseRefName="develop", isCrossRepository=False,
                    **values)

    def test_default_push_create_and_preserve_dirty_worktree(self):
        (self.repo / "base.txt").write_text("uncommitted\n", encoding="utf-8")
        before = self.git("status", "--porcelain")
        result = self.invoke()
        self.assertIn("未コミット", result.stderr)
        self.assertIn("/pull/7", result.stdout)
        self.assertEqual(self.git("status", "--porcelain"), before)
        self.assertEqual(self.git("branch", "--show-current"), self.source)
        self.assertEqual(self.git("rev-parse", "HEAD"),
                         self.git("rev-parse", "refs/heads/" + self.source, cwd=self.remote))
        create = self.calls("gh", ["pr", "create"])[0]
        self.assertEqual(create["args"][create["args"].index("--base") + 1], "develop")
        self.assertEqual(create["args"][create["args"].index("--repo") + 1], "github.com/test/chronolist")
        self.assertEqual(create["body"], self.body.read_text(encoding="utf-8"))
        self.assertEqual(len(self.calls("git", ["push"])), 1)
        self.assertNotIn("--force", self.calls("git", ["push"])[0]["args"])

    def test_already_pushed_existing_pr_updates_body_only(self):
        self.git("push", "origin", self.source)
        self.configure(prs=[self.pr()])
        self.invoke()
        self.assertFalse(self.calls("git", ["push"]))
        self.assertFalse(self.calls("gh", ["pr", "create"]))
        edit = self.calls("gh", ["pr", "edit"])[0]
        self.assertEqual(edit["args"][2], "7")
        self.assertNotIn("--title", edit["args"])
        self.assertEqual(edit["body"], self.body.read_text(encoding="utf-8"))

    def test_explicit_other_base(self):
        self.git("push", "origin", "develop:refs/heads/release/test")
        self.invoke("--base", "release/test")
        args = self.calls("gh", ["pr", "create"])[0]["args"]
        self.assertEqual(args[args.index("--base") + 1], "release/test")

    def test_main_requires_confirmation(self):
        result = self.invoke("--base", "main", ok=False)
        self.assertIn("ユーザー確認", result.stderr)
        self.assert_no_writes()
        self.invoke("--base", "main", "--confirm-main")

    def test_missing_develop_never_falls_back_to_main(self):
        self.git("push", "origin", ":refs/heads/develop")
        result = self.invoke(ok=False)
        self.assertIn("ベースブランチ develop", result.stderr)
        self.assert_no_writes()

    def test_missing_source(self):
        self.invoke(source="missing", ok=False)
        self.assert_no_writes()

    def test_invalid_source_and_ticket(self):
        for source in ("bad..name", "refs/heads/main", "bad name"):
            with self.subTest(source=source):
                self.invoke(source=source, ok=False)
        self.invoke("--ticket", "UNKNOWN", ok=False)
        self.assert_no_writes()

    def test_invalid_body(self):
        for content in ("## 概要\n不正", self.body.read_text(encoding="utf-8").replace("CHRON-196", "CHRON-197"),
                        self.body.read_text(encoding="utf-8").replace("補足なし", "{{NOTES}}")):
            self.body.write_text(content, encoding="utf-8")
            self.invoke(ok=False)
        self.assert_no_writes()

    def test_authentication_failure(self):
        self.configure(auth_fail=True)
        self.invoke(ok=False)
        self.assert_no_writes()

    def test_no_diff(self):
        result = self.invoke(source="main", ok=False)
        self.assertIn("差分がありません", result.stderr)
        self.assert_no_writes()

    def test_push_failure_stops_before_pr_write(self):
        self.configure(push_fail=True)
        self.invoke(ok=False)
        self.assertEqual(len(self.calls("git", ["push"])), 1)
        self.assertFalse(self.calls("gh", ["pr", "create"]))
        self.assertFalse(self.calls("gh", ["pr", "edit"]))

    def test_pr_lookup_failure_does_not_mean_no_existing_pr(self):
        self.configure(list_fail=True)
        self.invoke(ok=False)
        self.assert_no_writes()

    def test_dry_run_never_pushes_or_writes_pr(self):
        plan = json.loads(self.invoke("--dry-run").stdout)
        self.assertEqual(plan["action"], "create")
        self.assertTrue(plan["push"])
        self.assert_no_writes()

    def test_remote_divergence_is_rejected(self):
        base = self.git("rev-parse", "develop")
        tree = self.git("rev-parse", "develop^{tree}")
        other = self.git("commit-tree", tree, "-p", base, "-m", "other commit")
        self.git("push", "origin", other + ":refs/heads/" + self.source)
        result = self.invoke(ok=False)
        self.assertIn("分岐", result.stderr)
        self.assert_no_writes()

    def test_fork_pr_is_not_updated(self):
        pr = self.pr()
        pr["isCrossRepository"] = True
        self.configure(prs=[pr])
        self.invoke()
        self.assertTrue(self.calls("gh", ["pr", "create"]))
        self.assertFalse(self.calls("gh", ["pr", "edit"]))

    def test_multiple_matching_prs_stop(self):
        self.configure(prs=[self.pr(), self.pr()])
        self.invoke(ok=False)
        self.assert_no_writes()

    def test_mismatched_push_target_stops(self):
        self.configure(push_url="https://github.com/other/repository.git")
        self.invoke(ok=False)
        self.assert_no_writes()

    def test_create_and_edit_api_failure_reported(self):
        for state in ({"create_fail": True}, {"prs": [self.pr()], "edit_fail": True}):
            with self.subTest(state=state):
                self.configure(**state)
                self.invoke(ok=False)

    def test_source_is_independent_of_current_branch(self):
        expected_sha = self.git("rev-parse", "HEAD")
        self.git("checkout", "develop")
        self.invoke()
        self.assertEqual(self.git("branch", "--show-current"), "develop")
        self.assertEqual(self.git("rev-parse", "refs/heads/" + self.source, cwd=self.remote),
                         expected_sha)
        args = self.calls("gh", ["pr", "create"])[0]["args"]
        self.assertEqual(args[args.index("--head") + 1], self.source)

    def test_ssh_origin_is_supported(self):
        self.configure(fetch_url="git@github.com:test/chronolist.git",
                       push_url="ssh://git@github.com/test/chronolist.git")
        plan = json.loads(self.invoke("--dry-run").stdout)
        self.assertEqual(plan["repo"], "github.com/test/chronolist")

    def test_fetch_failure_stops(self):
        self.configure(fetch_fail=True)
        self.invoke(ok=False)
        self.assert_no_writes()

    def test_invalid_pr_response_stops(self):
        self.configure(bad_json=True)
        self.invoke(ok=False)
        self.assert_no_writes()

    def test_unknown_explicit_base_is_not_replaced(self):
        self.invoke("--base", "missing", ok=False)
        self.assert_no_writes()

    def test_same_source_and_base_stop(self):
        self.invoke("--base", self.source, ok=False)
        self.assert_no_writes()

    def test_mirror_remote_is_rejected(self):
        self.git("config", "remote.origin.mirror", "true")
        self.invoke(ok=False)
        self.assert_no_writes()

    def test_sensitive_client_diagnostics_are_not_printed(self):
        self.configure(fetch_url="https://secret-token@github.com/test/chronolist.git")
        result = self.invoke(ok=False)
        self.assertNotIn("secret-token", result.stdout + result.stderr)
        self.assert_no_writes()

    def test_missing_gh_stops_and_restores_working_directory(self):
        before = Path.cwd()
        self.configure(missing_gh=True)
        result = self.invoke(ok=False)
        self.assertIn("gh is unavailable", result.stderr)
        self.assertEqual(Path.cwd(), before)
        self.assert_no_writes()

    def test_utf8_subprocess_output_under_cp932_locale(self):
        # Exercise the real process boundary independently of the mocked gh client.
        with patch("locale.getencoding", return_value="cp932", create=True), \
                patch("locale.getpreferredencoding", return_value="cp932"):
            result = CREATE_PR.run(sys.executable, "-c",
                                   "import sys; sys.stdout.buffer.write('日本語'.encode('utf-8'))")
        self.assertEqual(result.stdout, "日本語")

    def test_success_restores_working_directory(self):
        before = Path.cwd()
        self.invoke()
        self.assertEqual(Path.cwd(), before)


if __name__ == "__main__":
    unittest.main()
