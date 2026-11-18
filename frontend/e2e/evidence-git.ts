import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream, lstatSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { EvidencePlan, Identity } from './evidence.ts';
import { EvidenceError } from './evidence-errors.ts';

/** stdoutを制限付きbufferに集約せず処理し、stderrは秘密を記録しない。 */
async function gitStream(root: string, args: string[], consume: (chunk: Buffer) => void) {
    await new Promise<void>((resolve, reject) => {
        const child = spawn('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] });
        child.stdout.on('data', consume);
        child.on('error', () => reject(new EvidenceError('identity-git')));
        child.on('close', code => code === 0 ? resolve() : reject(new EvidenceError('identity-git')));
    });
}
/** 差分digestと型・path・内容digestをJSON配列で区切る版付き指紋。リンク先は辿らない。 */
export async function evidenceIdentity(root: string, baseURL: string, apiBaseURL: string, plan: EvidencePlan): Promise<Identity> {
    const tracked = createHash('sha256');
    await gitStream(root, ['diff', 'HEAD', '--binary', '--no-ext-diff', '--no-textconv'], chunk => tracked.update(chunk));
    const paths: string[] = [];
    let pending = Buffer.alloc(0);
    await gitStream(root, ['ls-files', '--others', '--exclude-standard', '-z'], chunk => {
        pending = Buffer.concat([pending, chunk]);
        let end: number;
        while ((end = pending.indexOf(0)) >= 0) { paths.push(pending.subarray(0, end).toString('utf8')); pending = pending.subarray(end + 1); }
    });
    const changes = createHash('sha256').update(JSON.stringify(['dirty-v2', 'tracked', tracked.digest('hex')]));
    for (const path of paths.sort()) {
        try {
            const absolute = join(root, path);
            const stat = lstatSync(absolute);
            const content = createHash('sha256');
            let kind: string;
            if (stat.isSymbolicLink()) { kind = 'symlink'; content.update(readlinkSync(absolute)); }
            else if (stat.isFile()) { kind = 'file'; for await (const chunk of createReadStream(absolute)) content.update(chunk); }
            else throw new EvidenceError('identity-unsupported-entry');
            changes.update(JSON.stringify(['untracked', kind, path, content.digest('hex')]));
        } catch (error) { throw error instanceof EvidenceError ? error : new EvidenceError('identity-read'); }
    }
    let sha = '';
    await gitStream(root, ['rev-parse', 'HEAD'], chunk => { sha += chunk.toString('utf8'); });
    return { sha: sha.trim(), dirtyHash: changes.digest('hex'), baseURL, apiBaseURL,
        planHash: createHash('sha256').update(JSON.stringify(plan)).digest('hex') };
}
