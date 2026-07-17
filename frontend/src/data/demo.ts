import type { Notification } from '../types';

export const notifications: Notification[] = [
  { id: '1', message: 'Metalúrgica San Rafael SLA vencido', time: 'hace 1h', type: 'error', read: false, link: '/tracker/supplier/ps6' },
  { id: '2', message: 'Aprobación pendiente: Manufacturas del Bajío → Supplier Evaluation', time: 'hace 3h', type: 'warning', read: false, link: '/tracker/supplier/ps10' },
  { id: '3', message: 'Nuevo proveedor registrado: Grupo Industrial Delta', time: 'hace 5h', type: 'info', read: false, link: '/tracker/supplier/ps5' },
];
