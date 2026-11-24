import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEvidencePlan, captureCheckpoint, requireCheckpointSuccess } from '../e2e/evidence.ts';

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

test('安全なcause codeを保ち、機微情報を保存せずPlaywright側にも固定説明を返す', async () => {
    const { EvidenceError } = await import('../e2e/evidence-errors.ts');
    const failed = await captureCheckpoint(plan.checkpoints[0], async () => { throw new EvidenceError('image-decode'); }, async () => { throw new Error('secret URL password'); });
    assert.equal(failed.failures[0].code, 'verification');
    assert.equal(failed.failures[1].code, 'image-decode');
    assert.doesNotMatch(JSON.stringify(failed), /secret|password/);
    assert.throws(() => requireCheckpointSuccess(failed), /image-decode/);
    const timeout = new Error('secret'); timeout.name = 'TimeoutError';
    const waiting = await captureCheckpoint(plan.checkpoints[0], async () => { throw timeout; });
    assert.equal(waiting.failures[0].code, 'selector-timeout');
});

test('identity失敗でも初期recordを保存し未到達地点を残す', async () => {
    const { createEvidenceRecord, runEvidenceRecord } = await import('../e2e/evidence.ts');
    const { EvidenceError } = await import('../e2e/evidence-errors.ts');
    const record = createEvidenceRecord(parseEvidencePlan(plan));
    let saved: unknown;
    await assert.rejects(runEvidenceRecord(record, parseEvidencePlan(plan), value => { saved = JSON.parse(JSON.stringify(value)); }, async () => { throw new EvidenceError('identity-git'); }), /Git/);
    assert.equal(record.identity, null);
    assert.equal(record.failure?.stage, 'identity');
    assert.equal(record.failure?.code, 'identity-git');
    assert.equal(record.checkpoints.length, 2);
    assert.ok(record.checkpoints.every(point => point.capture === 'unverified'));
    assert.deepEqual(saved, record);
});



test('checkpoint中断の原因は最上位recordと再throwにも保持される', async () => {
    const { createEvidenceRecord, runEvidenceRecord } = await import('../e2e/evidence.ts');
    const { EvidenceError } = await import('../e2e/evidence-errors.ts');
    const record = createEvidenceRecord(parseEvidencePlan(plan));
    record.stage = 'operation';
    await assert.rejects(runEvidenceRecord(record, parseEvidencePlan(plan), () => {}, async () => {
        const result = await captureCheckpoint(plan.checkpoints[0], async () => { throw new EvidenceError('image-timeout'); }, async () => {});
        record.checkpoints.push(result); requireCheckpointSuccess(result);
    }), /image-timeout/);
    assert.equal(record.failure?.code, 'image-timeout');
    assert.equal(record.failure?.stage, 'capture');
    assert.equal(record.checkpoints[0].verification, 'passed');
});

test('assertionと未知の検証処理失敗を区別し本文を保存しない', async () => {
    const assertion = new Error('private difference'); assertion.name = 'AssertionError';
    const result = await captureCheckpoint(plan.checkpoints[0], async () => 'draft.png', async () => { throw assertion; });
    assert.equal(result.failures[0].code, 'assertion');
    assert.doesNotMatch(JSON.stringify(result), /private/);
});

test('Playwrightのexpect不一致は機微な差分を捨てassertionとして残す', async () => {
    const { expect } = await import('@playwright/test');
    const result = await captureCheckpoint(plan.checkpoints[0], async () => 'draft.png', async () => { expect('private received').toBe('private expected'); });
    assert.equal(result.failures[0].code, 'assertion');
    assert.doesNotMatch(JSON.stringify(result), /private/);
});
