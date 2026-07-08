/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  // Fix Next.js/Turbopack workspace-root inference when multiple lockfiles exist.
  turbopack: {
    root: 'D:\\softcenteric\\Job\\Al-janat\\al-jannat',
  },
};

export default nextConfig;

