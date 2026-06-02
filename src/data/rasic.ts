export type RasicLetter = 'R' | 'A' | 'S' | 'C' | 'I' | 'R/A';
export type AppRole = 'SSD' | 'PM' | 'Buyer' | 'SQD';

export interface RasicActivity {
  id: number;
  name: string;
  roles: Record<AppRole, RasicLetter>;
}

export const RASIC_MATRIX: RasicActivity[] = [
  { id: 1,  name: 'Define Supplier Development Needed',        roles: { SSD: 'I',   PM: 'A',   Buyer: 'R',   SQD: 'I' } },
  { id: 2,  name: 'Define Master Requirement List',            roles: { SSD: 'R',   PM: 'A',   Buyer: 'I',   SQD: 'C' } },
  { id: 3,  name: 'Prepare sourcing event plan',               roles: { SSD: 'R',   PM: 'A',   Buyer: 'S',   SQD: 'C' } },
  { id: 4,  name: 'Execute sourcing event',                    roles: { SSD: 'R',   PM: 'A',   Buyer: 'S',   SQD: 'I' } },
  { id: 5,  name: 'Collect supplier information',              roles: { SSD: 'R',   PM: 'I',   Buyer: 'S',   SQD: 'I' } },
  { id: 6,  name: 'Create preliminary supplier list',          roles: { SSD: 'R',   PM: 'I',   Buyer: 'C',   SQD: 'C' } },
  { id: 7,  name: 'Create / update Parking Lot List',          roles: { SSD: 'R',   PM: 'I',   Buyer: 'I',   SQD: 'I' } },
  { id: 8,  name: 'Perform commercial evaluation',             roles: { SSD: 'S',   PM: 'A',   Buyer: 'C',   SQD: 'I' } },
  { id: 9,  name: 'Decide the requirements',                   roles: { SSD: 'C',   PM: 'R',   Buyer: 'R',   SQD: 'I' } },
  { id: 10, name: 'Create the event agenda',                   roles: { SSD: 'R',   PM: 'A',   Buyer: 'S',   SQD: 'C' } },
  { id: 11, name: 'Communicate GSM team results',              roles: { SSD: 'R',   PM: 'I',   Buyer: 'I',   SQD: 'I' } },
  { id: 12, name: 'Supplier Development review meeting',       roles: { SSD: 'R',   PM: 'A',   Buyer: 'C',   SQD: 'C' } },
  { id: 13, name: 'Decision: advance or parking lot',          roles: { SSD: 'I',   PM: 'R/A', Buyer: 'R/A', SQD: 'C' } },
  { id: 14, name: 'Evaluate supplier requirements compliance', roles: { SSD: 'R',   PM: 'A',   Buyer: 'C',   SQD: 'C' } },
  { id: 15, name: 'Start supplier development evaluation',     roles: { SSD: 'R',   PM: 'A',   Buyer: 'C',   SQD: 'I' } },
  { id: 16, name: 'Execute supplier development activities',   roles: { SSD: 'R',   PM: 'I',   Buyer: 'S',   SQD: 'I' } },
  { id: 17, name: 'Advance supplier to next stage',            roles: { SSD: 'C',   PM: 'R/A', Buyer: 'R/A', SQD: 'I' } },
  { id: 18, name: 'Monitor suppliers in Parking Lot',          roles: { SSD: 'R',   PM: 'I',   Buyer: 'I',   SQD: 'I' } },
  { id: 19, name: 'Scouting Event Agenda',                     roles: { SSD: 'R/A', PM: 'I',   Buyer: 'I',   SQD: 'I' } },
  { id: 20, name: 'Supplier Quality Assessment',               roles: { SSD: 'I',   PM: 'A',   Buyer: 'I',   SQD: 'R' } },
  { id: 21, name: 'Organize Supplier Scouting Event',          roles: { SSD: 'R',   PM: 'I',   Buyer: 'I',   SQD: 'I' } },
  { id: 22, name: 'Review preliminary supplier list',          roles: { SSD: 'R',   PM: 'I',   Buyer: 'I',   SQD: 'I' } },
  { id: 23, name: 'Decide B2B-eligible supplier',              roles: { SSD: 'I',   PM: 'R/A', Buyer: 'R/A', SQD: 'I' } },
  { id: 24, name: 'Coordinate B2B meeting location',           roles: { SSD: 'R',   PM: 'I',   Buyer: 'I',   SQD: 'I' } },
  { id: 25, name: 'Weekly Parking Lot decision',               roles: { SSD: 'I',   PM: 'R/A', Buyer: 'R/A', SQD: 'I' } },
  { id: 26, name: 'Initiate Preliminary Evaluation',           roles: { SSD: 'R',   PM: 'I',   Buyer: 'I',   SQD: 'I' } },
  { id: 27, name: 'Complete Preliminary Evaluation RFQ',       roles: { SSD: 'I',   PM: 'I',   Buyer: 'R',   SQD: 'I' } },
  { id: 28, name: 'Provide quality feedback',                  roles: { SSD: 'I',   PM: 'I',   Buyer: 'I',   SQD: 'R' } },
  { id: 29, name: 'Determine eligibility to proceed',          roles: { SSD: 'I',   PM: 'R/A', Buyer: 'R/A', SQD: 'I' } },
  { id: 30, name: 'Create investigation record',               roles: { SSD: 'I',   PM: 'I',   Buyer: 'R/A', SQD: 'I' } },
];

export const DUAL_APPROVAL_ACTIVITIES = [13, 17, 23, 25, 29, 30];
