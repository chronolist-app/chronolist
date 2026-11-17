import { test, expect, createAccount, loginThroughUi, seedTask, requestFromBrowser } from './fixtures';

test('2 worktree の認証・ユーザー・データを同じブラウザ内で分離する', async ({ page, account, environment }) => {
    const peer = environment.peer;
    test.skip(!peer, '隔離検証には E2E_PEER_BASE_URL と E2E_PEER_API_BASE_URL が必要です。');
    if (!peer) return;

    // primary の Cookie を持ったまま peer API を呼び、認証されないことを確認する。
    const peerPage = await page.context().newPage();
    await peerPage.goto(`${peer.baseURL}/login`);
    const unauthenticated = await requestFromBrowser(peerPage, peer.apiBaseURL, '/todolist/getAll');
    expect(unauthenticated.status).toBe(401);
    // primary だけに登録したユーザーでは peer にログインできない。
    const unknownAccount = await requestFromBrowser(peerPage, peer.apiBaseURL, '/login', {
        loginId: account.loginId, password: account.password,
    });
    expect(unknownAccount.status).toBe(401);

    const peerAccount = await createAccount(peerPage, peer.apiBaseURL);
    await loginThroughUi(peerPage, peer.baseURL, peer.apiBaseURL, peerAccount);
    await seedTask(peerPage, peer.apiBaseURL, peerAccount.seedTitle);
    await peerPage.goto(`${peer.baseURL}/todolist`);
    await expect(peerPage.getByText(peerAccount.seedTitle, { exact: true })).toBeVisible();
    await expect(peerPage.getByText(account.seedTitle, { exact: true })).toHaveCount(0);

    const primaryTasks = await requestFromBrowser(page, environment.apiBaseURL, '/todolist/getAll');
    expect(primaryTasks.ok).toBeTruthy();
    expect(primaryTasks.body).toEqual([expect.objectContaining({ title: account.seedTitle })]);
    const peerTasks = await requestFromBrowser(peerPage, peer.apiBaseURL, '/todolist/getAll');
    expect(peerTasks.ok).toBeTruthy();
    expect(peerTasks.body).toEqual([expect.objectContaining({ title: peerAccount.seedTitle })]);
    await page.goto(`${environment.baseURL}/todolist`);
    await expect(page.getByText(account.seedTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(peerAccount.seedTitle, { exact: true })).toHaveCount(0);
});
