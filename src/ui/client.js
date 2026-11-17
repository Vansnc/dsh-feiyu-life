// Browser entry: DSH loads this generated client and the factory receives React.
import { createUI } from './app.js'
window.__ModuleLoader__.load({ id: 'dsh-feiyu-life', factory: (require) => createUI(require) })
