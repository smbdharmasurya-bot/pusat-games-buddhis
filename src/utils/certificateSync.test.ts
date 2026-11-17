import test from 'node:test';
import assert from 'node:assert/strict';
import { Certificate } from '../types';
import {
  countCertificateStatuses,
  filterCertificates,
  isCertificateActive,
  resolveCertificateVerificationState,
} from './certificateSync';

const sampleCertificates: Certificate[] = [
  {
    id: 'CERT-2026-001',
    studentName: 'Ananda Budi Santoso',
    module: 'Dasar-Dasar Tripitaka',
    institution: 'Vihara Buddhayana',
    date: '2026-03-15',
    certificateNumber: 'PGB/DHARMA/2026/001',
    verificationCode: 'CERT-2026-001',
    isActive: true,
    status: 'active',
  },
  {
    id: 'CERT-2026-002',
    studentName: 'Saddhavati Dewi',
    module: 'Pancasila Buddhis',
    institution: 'SMP Maitreyawira',
    date: '2026-04-10',
    certificateNumber: 'PGB/DHARMA/2026/002',
    verificationCode: 'CERT-2026-002',
    isActive: false,
    status: 'inactive',
  },
];

test('isCertificateActive checks both isActive flag and status field', () => {
  assert.equal(isCertificateActive({ isActive: true, status: 'active' }), true);
  assert.equal(isCertificateActive({ isActive: undefined, status: undefined }), true);
  assert.equal(isCertificateActive({ isActive: false, status: 'active' }), false);
  assert.equal(isCertificateActive({ isActive: true, status: 'inactive' }), false);
});

test('countCertificateStatuses counts total, active, and inactive accurately', () => {
  assert.deepEqual(countCertificateStatuses(sampleCertificates), {
    total: 2,
    active: 1,
    inactive: 1,
  });
});

test('filterCertificates filters by status and search query', () => {
  assert.equal(filterCertificates(sampleCertificates, 'all').length, 2);
  assert.equal(filterCertificates(sampleCertificates, 'active').length, 1);
  assert.equal(filterCertificates(sampleCertificates, 'inactive').length, 1);
  assert.equal(filterCertificates(sampleCertificates, 'all', 'Maitreyawira')[0].id, 'CERT-2026-002');
  assert.equal(filterCertificates(sampleCertificates, 'active', 'Maitreyawira').length, 0);
});

test('resolveCertificateVerificationState distinguishes valid, inactive, and not_found', () => {
  assert.equal(resolveCertificateVerificationState(null), 'not_found');
  assert.equal(
    resolveCertificateVerificationState({ ...sampleCertificates[0], isValid: true }),
    'valid'
  );
  assert.equal(
    resolveCertificateVerificationState({ ...sampleCertificates[1], isValid: false }),
    'inactive'
  );
  assert.equal(
    resolveCertificateVerificationState({ ...sampleCertificates[0], isActive: false }),
    'inactive'
  );
});
