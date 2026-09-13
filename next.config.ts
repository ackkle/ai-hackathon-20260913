import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // AGENTS.md は CLAUDE.md へのシンボリックリンク。
  // Next.js の自動追記を切らないと、チームの CLAUDE.md が書き換わる
  agentRules: false,
};

export default nextConfig;
