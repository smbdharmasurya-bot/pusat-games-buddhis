import { Certificate } from '../types';

export type CertificateStatusFilter = 'all' | 'active' | 'inactive';

export function isCertificateActive(
  cert: Pick<Certificate, 'isActive' | 'status'>
): boolean {
  if (cert.isActive === false) return false;
  if (cert.status === 'inactive') return false;
  return true;
}

export function countCertificateStatuses(
  certificates: Array<Pick<Certificate, 'isActive' | 'status'>>
): { total: number; active: number; inactive: number } {
  let active = 0;
  let inactive = 0;
  for (const cert of certificates) {
    if (isCertificateActive(cert)) {
      active += 1;
    } else {
      inactive += 1;
    }
  }
  return {
    total: certificates.length,
    active,
    inactive,
  };
}

export function filterCertificates(
  certificates: Certificate[],
  statusFilter: CertificateStatusFilter,
  searchQuery = ''
): Certificate[] {
  const q = searchQuery.trim().toLowerCase();
  return certificates.filter((cert) => {
    const active = isCertificateActive(cert);
    const matchesStatus =
      statusFilter === 'all' ? true : statusFilter === 'active' ? active : !active;
    if (!matchesStatus) return false;
    if (!q) return true;

    return (
      cert.studentName.toLowerCase().includes(q) ||
      cert.verificationCode.toLowerCase().includes(q) ||
      cert.certificateNumber.toLowerCase().includes(q) ||
      cert.module.toLowerCase().includes(q) ||
      cert.institution.toLowerCase().includes(q)
    );
  });
}

export function resolveCertificateVerificationState(
  cert: (Certificate & { isValid?: boolean }) | null
): 'not_found' | 'inactive' | 'valid' {
  if (!cert) return 'not_found';
  if (!isCertificateActive(cert) || cert.isValid === false) {
    return 'inactive';
  }
  return 'valid';
}
