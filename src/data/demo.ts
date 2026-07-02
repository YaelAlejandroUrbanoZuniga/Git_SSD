import type { Notification } from '../types';

export const notifications: Notification[] = [
  { id: '1', message: 'KERN LIEBERS SLA vencido', time: 'hace 1h', type: 'error', read: false, link: '/pipeline/supplier/ps6' },
  { id: '2', message: 'Aprobación pendiente: JTEKT → Supplier Evaluation', time: 'hace 3h', type: 'warning', read: false, link: '/pipeline/supplier/ps10' },
  { id: '3', message: 'Nuevo proveedor registrado: MANDO', time: 'hace 5h', type: 'info', read: false, link: '/pipeline/supplier/ps5' },
];
