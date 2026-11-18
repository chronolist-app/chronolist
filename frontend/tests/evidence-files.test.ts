import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, copyFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { evidenceIdentity, createEvidenceRecord } from '../e2e/evidence.ts';
import * as files from '../e2e/evidence-files.ts';
const plan = { purpose: '確認', scenario: 'todo' as const, title: 'タスク', checkpoints: [{ id: 'draft', requirement: '入力', expected: '表示' }] };
function repository(t: test.TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'evidence-git-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
    git('init'); git('config', 'user.name', '証跡テスト'); git('config', 'user.email', 'evidence@example.invalid');
    writeFileSync(join(root, 'tracked'), 'initial'); git('add', '.'); git('commit', '-m', '初期状態');
    return { root, git };
}
test('1MiBを超える管理対象binary差分を指紋化できる', async t => {
    const { root, git } = repository(t);
    writeFileSync(join(root, 'binary'), randomBytes(1200000)); git('add', '.'); git('commit', '-m', 'バイナリ');
    writeFileSync(join(root, 'binary'), randomBytes(1200000));
    const result = await evidenceIdentity(root, 'http://fe', 'http://api', plan);
    assert.match(result.dirtyHash, /^[a-f0-9]{64}$/);
});
test('未追跡pathと内容の境界が違う状態は異なる指紋になる', async t => {
    const { root } = repository(t);
    writeFileSync(join(root, 'a'), 'bc');
    const first = await evidenceIdentity(root, 'http://fe', 'http://api', plan);
    rmSync(join(root, 'a')); writeFileSync(join(root, 'ab'), 'c');
    assert.notEqual((await evidenceIdentity(root, 'http://fe', 'http://api', plan)).dirtyHash, first.dirtyHash);
});
test('未追跡nested Git directoryは安全な明示エラーで停止する', async t => {
    const { root } = repository(t);
    mkdirSync(join(root, 'nested')); execFileSync('git', ['init'], { cwd: join(root, 'nested'), stdio: 'pipe' });
    await assert.rejects(async () => evidenceIdentity(root, 'http://fe', 'http://api', plan), error => {
        assert.equal((error as { code: string }).code, 'identity-unsupported-entry');
        assert.doesNotMatch(String(error), /EISDIR|nested/);
        return true;
    });
});

const identity = { sha: 'abc', dirtyHash: '123', baseURL: 'http://fe', apiBaseURL: 'http://api', planHash: '456' };
function records(t: test.TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'evidence-files-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const results = join(root, 'frontend', 'e2e-results');
    const source = join(results, 'old', 'evidence.json');
    const target = join(results, 'new', 'evidence.json');
    mkdirSync(join(results, 'old'), { recursive: true }); mkdirSync(join(results, 'new'), { recursive: true });
    const image = join(results, 'old', 'draft.png'); writeFileSync(image, 'image');
    const record = { ...createEvidenceRecord(plan), identity, worktree: '/work/foreign-mount', checkpoints: [{ ...plan.checkpoints[0], capture: 'passed', verification: 'passed', path: 'draft.png', sha256: createHash('sha256').update('image').digest('hex'), failures: [] }] };
    const save = () => writeFileSync(source, JSON.stringify(record)); save();
    return { root, results, source, target, image, record, save };
}
test('移設した生成root内で相対配置とhashを使って再利用し参照を書き換える', t => {
    const old = records(t); const moved = records(t);
    copyFileSync(old.source, moved.source); copyFileSync(old.image, moved.image);
    const result = files.reuseEvidence(moved.source, moved.target, moved.results, identity, plan);
    assert.equal(result.reason, ''); assert.equal(result.checkpoints?.[0].path, '../old/draft.png');
    assert.equal(readFileSync(moved.image, 'utf8'), 'image');
});
test('画像改変・欠損・absolute・escape・旧版・必要地点欠損・重複を再利用しない', t => {
    const data = records(t);
    const check = () => files.reuseEvidence(data.source, data.target, data.results, identity, plan);
    writeFileSync(data.image, 'changed'); assert.equal(check().reason, 'image-invalid');
    rmSync(data.image); assert.equal(check().reason, 'image-invalid'); writeFileSync(data.image, 'image');
    for (const path of ['/absolute.png', 'C:/absolute.png', '../../../outside.png']) {
        data.record.checkpoints[0].path = path; data.save(); assert.equal(check().reason, 'image-invalid');
    }
    data.record.checkpoints[0].path = 'draft.png';
    data.record.schemaVersion = 1 as 2; data.save(); assert.equal(check().reason, 'unsupported-schema');
    data.record.schemaVersion = 2; data.record.checkpoints[0].sha256 = ''; data.save(); assert.equal(check().reason, 'image-invalid');
    data.record.checkpoints = []; data.save(); assert.equal(check().reason, 'checkpoints-mismatch');
});
test('読めない既存recordは安全な拒否理由を返し新規取得へ進められる', t => {
    const data = records(t);
    writeFileSync(data.source, 'secret broken JSON');
    assert.equal(files.reuseEvidence(data.source, data.target, data.results, identity, plan).reason, 'invalid-json');
    rmSync(data.source);
    assert.equal(files.reuseEvidence(data.source, data.target, data.results, identity, plan).reason, 'not-found');
    mkdirSync(data.source);
    assert.equal(files.reuseEvidence(data.source, data.target, data.results, identity, plan).reason, 'read-failed');
});

test('identityの全項目と必要地点の一意性・成功状態を照合する', t => {
    const data = records(t);
    const check = () => files.reuseEvidence(data.source, data.target, data.results, identity, plan);
    for (const key of Object.keys(identity) as (keyof typeof identity)[]) {
        data.record.identity = { ...identity, [key]: 'changed' }; data.save();
        assert.equal(check().reason, 'identity-mismatch');
    }
    data.record.identity = identity;
    const point = { ...data.record.checkpoints[0] };
    data.record.checkpoints = [point, point]; data.save(); assert.equal(check().reason, 'checkpoints-mismatch');
    data.record.checkpoints = [{ ...point, verification: 'unverified' }]; data.save(); assert.equal(check().reason, 'checkpoint-not-passed');
    data.record.checkpoints = [{ ...point, capture: 'failed' }]; data.save(); assert.equal(check().reason, 'checkpoint-not-passed');
});

test('identity失敗でもevidence.jsonをFSへ保存し成功値を補わない', async t => {
    const data = records(t);
    const { runEvidenceRecord } = await import('../e2e/evidence.ts');
    const record = createEvidenceRecord(plan);
    await assert.rejects(runEvidenceRecord(record, plan, value => writeFileSync(data.target, JSON.stringify(value)), async () => {
        record.identity = await evidenceIdentity(join(data.root, 'missing'), 'http://fe', 'http://api', plan);
    }), /identity-git/);
    const saved = JSON.parse(readFileSync(data.target, 'utf8'));
    assert.equal(saved.identity, null); assert.equal(saved.failure.code, 'identity-git');
    assert.equal(saved.checkpoints[0].capture, 'unverified');
});


test('生成root外へのdirectory linkを経由する画像参照を拒否する', t => {
    const data = records(t);
    const outside = join(data.root, 'outside'); mkdirSync(outside); writeFileSync(join(outside, 'draft.png'), 'image');
    symlinkSync(outside, join(data.results, 'old', 'link'), process.platform === 'win32' ? 'junction' : 'dir');
    data.record.checkpoints[0].path = 'link/draft.png'; data.save();
    assert.equal(files.reuseEvidence(data.source, data.target, data.results, identity, plan).reason, 'image-invalid');
});

test('未追跡symlinkは外部targetの内容を辿らずリンク先文字列だけを指紋化する', async t => {
    const { root } = repository(t);
    const outside = mkdtempSync(join(tmpdir(), 'evidence-link-'));
    t.after(() => rmSync(outside, { recursive: true, force: true }));
    const target = join(outside, 'target'); writeFileSync(target, 'before');
    try { symlinkSync(target, join(root, 'link'), 'file'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'EPERM') { t.skip('OSがfile symlink作成を許可しない'); return; } throw error; }
    const before = await evidenceIdentity(root, 'http://fe', 'http://api', plan);
    writeFileSync(target, 'after');
    assert.equal((await evidenceIdentity(root, 'http://fe', 'http://api', plan)).dirtyHash, before.dirtyHash);
    rmSync(join(root, 'link')); symlinkSync(join(outside, 'missing'), join(root, 'link'), 'file');
    assert.notEqual((await evidenceIdentity(root, 'http://fe', 'http://api', plan)).dirtyHash, before.dirtyHash);
});
