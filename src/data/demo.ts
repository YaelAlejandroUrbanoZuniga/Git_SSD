export interface Supplier {
  id: string;
  name: string;
  category: string;
  stage: string;
  status: 'active' | 'pending' | 'blacklisted';
  daysInStage: number;
  docsPercent: number;
  sla: 'green' | 'yellow' | 'red';
  contact?: string;
}

export interface Event {
  id: string;
  name: string;
  location: string;
  date: string;
  month: string;
  day: string;
  supplierCount: number;
  status: 'Upcoming' | 'Ongoing' | 'Completed';
  organizer: string;
}

export interface Notification {
  id: string;
  message: string;
  time: string;
  type: 'error' | 'warning' | 'info';
  read: boolean;
}

export const suppliers: Supplier[] = [
  { id: '1', name: 'BOSCH', category: 'Auto Parts', stage: 'B2B', status: 'active', daysInStage: 12, docsPercent: 80, sla: 'green' },
  { id: '2', name: 'DANA INC', category: 'Steering', stage: 'RFQ', status: 'active', daysInStage: 3, docsPercent: 100, sla: 'green' },
  { id: '3', name: 'KERN LIEBERS', category: 'Springs', stage: 'Parking Lot', status: 'pending', daysInStage: 45, docsPercent: 60, sla: 'yellow' },
  { id: '4', name: 'DENSO', category: 'Electronics', stage: 'Scouting Event', status: 'active', daysInStage: 8, docsPercent: 40, sla: 'green' },
  { id: '5', name: 'JTEKT', category: 'Bearings', stage: 'Preliminary Evaluation', status: 'pending', daysInStage: 62, docsPercent: 90, sla: 'red' },
  { id: '6', name: 'THYSSENKRUPP', category: 'Steel', stage: 'Scouting Event', status: 'active', daysInStage: 15, docsPercent: 20, sla: 'yellow' },
  { id: '7', name: 'MANDO', category: 'Brakes', stage: 'Scouting Event', status: 'active', daysInStage: 5, docsPercent: 70, sla: 'green' },
  { id: '8', name: 'NEXTEER CHINA', category: 'Components', stage: 'Blacklisted', status: 'blacklisted', daysInStage: 88, docsPercent: 100, sla: 'red' },
  { id: '9', name: 'AISIN', category: 'Transmission', stage: 'Scouting Event', status: 'active', daysInStage: 7, docsPercent: 10, sla: 'green' },
  { id: '10', name: 'CONTINENTAL', category: 'Electronics', stage: 'B2B', status: 'active', daysInStage: 20, docsPercent: 55, sla: 'yellow' },
  { id: '11', name: 'ZF GROUP', category: 'Chassis', stage: 'Scouting Event', status: 'active', daysInStage: 2, docsPercent: 15, sla: 'green' },
  { id: '12', name: 'SCHAEFFLER', category: 'Bearings', stage: 'Scouting Event', status: 'active', daysInStage: 10, docsPercent: 45, sla: 'green' },
];

export const events: Event[] = [
  { id: '1', name: 'Automotive Supplier Summit 2026', location: 'Monterrey, NL', date: '2026-06-15', month: 'JUN', day: '15', supplierCount: 12, status: 'Upcoming', organizer: 'Nexteer Procurement' },
  { id: '2', name: 'Scouting B2B Sessions Q2', location: 'Detroit, MI', date: '2026-05-10', month: 'MAY', day: '10', supplierCount: 8, status: 'Completed', organizer: 'SSD Team' },
  { id: '3', name: 'EV Components Fair 2026', location: 'Querétaro, QRO', date: '2026-07-22', month: 'JUL', day: '22', supplierCount: 0, status: 'Upcoming', organizer: 'Innovation Dept.' },
];

export const notifications: Notification[] = [
  { id: '1', message: 'KERN LIEBERS SLA vencido', time: 'hace 1h', type: 'error', read: false },
  { id: '2', message: 'Aprobación pendiente: JTEKT → RFQ', time: 'hace 3h', type: 'warning', read: false },
  { id: '3', message: 'Nuevo proveedor registrado: MANDO', time: 'hace 5h', type: 'info', read: false },
];

export const pipelineStages = [
  { name: 'Scouting Event', color: '#02B3E1', count: 3 },
  { name: 'B2B', color: '#6366F1', count: 2 },
  { name: 'Parking Lot', color: '#D4A017', count: 1 },
  { name: 'Preliminary Evaluation', color: '#E3650B', count: 1 },
  { name: 'RFQ', color: '#6ABF4B', count: 1 },
  { name: 'Blacklisted', color: '#DC0202', count: 1 },
];

export const recentActivity = [
  { icon: 'fa-arrow-right', text: 'Supplier BOSCH moved to B2B', time: 'hace 2h' },
  { icon: 'fa-plus', text: 'MANDO registrado como nuevo proveedor', time: 'hace 5h' },
  { icon: 'fa-check', text: 'DANA INC completó documentación', time: 'hace 8h' },
  { icon: 'fa-exclamation-triangle', text: 'JTEKT SLA próximo a vencer', time: 'hace 12h' },
  { icon: 'fa-file', text: 'DENSO subió certificación ISO', time: 'hace 1d' },
];
