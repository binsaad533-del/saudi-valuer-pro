export function generateVerificationToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const segments = [4, 4, 4];
  const parts = segments.map((len) => {
    let s = "";
    for (let i = 0; i < len; i++) {
      s += chars[Math.floor(Math.random() * chars.length)];
    }
    return s;
  });
  return `vrf-${parts.join("-")}`;
}
