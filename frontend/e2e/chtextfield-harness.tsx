import 'bootstrap/dist/css/bootstrap.min.css';
import { createRoot } from 'react-dom/client';
import { FieldStates } from './CHTextFieldStates';

// 実アプリと同様、Bootstrapを先に読み込んでからReactを描画する。
createRoot(document.getElementById('root')!).render(<FieldStates />);
