import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import CHTextField from '../src/components/CHTextField';

// 開発用Viteの検証HTMLからだけ読み込む。製品のルートには登録しない。
/** ブラウザ検証専用の入力状態一覧を表示する。 */
export const FieldStates = () => {
    const [value, setValue] = useState('');
    const [blurred, setBlurred] = useState('未実行');
    return <main style={{ padding: 16, display: 'grid', gap: 24 }}>
        <CHTextField label="通常" value={value} onChange={event => setValue(event.target.value)} fullWidth />
        <CHTextField label="小サイズ" size="small" fullWidth helperText="補助文" />
        <CHTextField label="標準サイズ" size="medium" fullWidth />
        <CHTextField label="必須" required fullWidth />
        <CHTextField label="無効" disabled defaultValue="変更不可" fullWidth />
        <CHTextField label="パスワード" type="password" fullWidth />
        <CHTextField label="読み取り専用" readOnly defaultValue="参照" fullWidth />
        <CHTextField label="長いラベルとエラー表示の確認" error fullWidth
            helperText={'長い補助文が狭い画面でも折り返され、最後まで読めることを確認します。'.repeat(3)} />
        <CHTextField label="複数行" multiline rows={3} fullWidth />
        <CHTextField label="Enterで確定" fullWidth
            onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
            onBlur={event => setBlurred(`確定:${event.currentTarget.tagName}:${event.currentTarget.value}`)} />
        <CHTextField label="複数行のEnterで確定" multiline rows={2} fullWidth
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}
            onBlur={event => setBlurred(`確定:${event.currentTarget.tagName}:${event.currentTarget.value}`)} />
        <output aria-label="確定イベント">{blurred}</output>
        <button type="button">最後の操作</button>
    </main>;
};

createRoot(document.getElementById('root')!).render(<FieldStates />);
