import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEvidencePlan, captureCheckpoint, canReuseEvidence, requireCheckpointSuccess } from '../e2e/evidence.ts';

const plan = { purpose: '入力と保存を確認', scenario: 'todo', title: '証跡タスク', checkpoints: [
    { id: 'draft', requirement: '入力途中', expected: 'タスク名が入力済み' },
    { id: 'saved', requirement: '登録結果', expected: '再読込後も一覧に表示' },
] };

test('曖昧な要求は操作開始前に拒否する', () => {
    assert.throws(() => parseEvidencePlan({ purpose: '画面を撮って' }), /計画/);
    assert.throws(() => parseEvidencePlan({ ...plan, checkpoints: [{ id: '../escape', requirement: 'a', expected: 'b' }] }), /計画/);
    assert.deepEqual(parseEvidencePlan(plan), plan);
});

test('撮影成功と確認成功を独立に記録する', async () => {
    const captured = await captureCheckpoint(plan.checkpoints[0], async () => 'draft.png', async () => { throw new Error('不一致'); });
    assert.equal(captured.capture, 'passed');
    assert.equal(captured.verification, 'failed');
    const failed = await captureCheckpoint(plan.checkpoints[0], async () => { throw new Error('保存不可'); }, async () => {});
    assert.equal(failed.capture, 'failed');
    assert.equal(failed.verification, 'passed');
    const unknown = await captureCheckpoint(plan.checkpoints[0], async () => 'draft.png');
    assert.equal(unknown.verification, 'unverified');
});

test('現在のコード・環境・要求と成功済み成果物が一致する証跡だけ再利用する', () => {
    const identity = { sha: 'abc', dirtyHash: '123', baseURL: 'http://one.localhost:20000', apiBaseURL: 'http://one.localhost:20001', planHash: '456' };
    const result = { ...identity, checkpoints: [{ capture: 'passed', verification: 'passed', path: 'draft.png' }] };
    assert.equal(canReuseEvidence(result, identity, () => true), true);
    assert.equal(canReuseEvidence(result, { ...identity, dirtyHash: 'changed' }, () => true), false);
    assert.equal(canReuseEvidence(result, identity, () => false), false);
    assert.equal(canReuseEvidence({ ...result, checkpoints: [{ capture: 'passed', verification: 'unverified', path: 'draft.png' }] }, identity, () => true), false);
    assert.equal(canReuseEvidence(null, identity, () => true), false);
    assert.equal(canReuseEvidence({ ...identity }, identity, () => true), false);
    assert.equal(canReuseEvidence(result, identity, () => true, parseEvidencePlan(plan)), false);
    const complete = { ...identity, checkpoints: plan.checkpoints.map(point => ({ ...point, capture: 'passed', verification: 'passed', path: `${point.id}.png` })) };
    assert.equal(canReuseEvidence(complete, identity, () => true, parseEvidencePlan(plan)), true);
    assert.equal(canReuseEvidence({ ...complete, checkpoints: [complete.checkpoints[0], complete.checkpoints[0]] }, identity, () => true, parseEvidencePlan(plan)), false);
});

test('確認失敗後も画像は取得し、後続の変更操作は実行しない', async () => {
    const operations: string[] = [];
    await assert.rejects(async () => {
        const result = await captureCheckpoint(plan.checkpoints[0], async () => {
            operations.push('撮影'); return 'draft.png';
        }, async () => { throw new Error('期待状態不一致'); });
        requireCheckpointSuccess(result);
        operations.push('保存操作');
    }, /中断/);
    assert.deepEqual(operations, ['撮影']);
    assert.throws(() => requireCheckpointSuccess({ capture: 'failed', verification: 'passed' }), /中断/);
});
