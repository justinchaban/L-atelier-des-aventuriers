import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Set VITE_BASE_PATH to '/repository-name/' for GitHub project pages.
export default defineConfig({ plugins: [react()], base: process.env.VITE_BASE_PATH || '/' });
