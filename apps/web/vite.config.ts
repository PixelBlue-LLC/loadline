import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// base './'：打包后的文件用相对路径，放在 GitHub Pages 子路径或任何静态托管都能直接打开
export default defineConfig({ base: './', plugins: [react()] });
