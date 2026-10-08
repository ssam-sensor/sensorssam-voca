export function maskEmail(email?: string): string {
  if (!email) return '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [name, domain] = parts;
  const maskedName = name.length > 2 ? `${name.slice(0, 2)}***` : `${name}***`;
  return `${maskedName}@${domain}`;
}

export function maskName(name?: string, email?: string): string {
  if (name && name.trim()) return name;
  if (email) {
    const prefix = email.split('@')[0];
    const maskedPrefix = prefix.length > 2 ? `${prefix.slice(0, 2)}***` : `${prefix}***`;
    return `${maskedPrefix} 튜터`;
  }
  return '등록 튜터';
}
