/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  // Allow phone/other devices on the LAN to load dev assets when using the network URL
  allowedDevOrigins: ["192.168.68.113"],
};

export default nextConfig;
