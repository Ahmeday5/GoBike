import { notificationLink } from './notification-center.service';

/** Deep-link table from the API brief (§5.12). */
describe('notificationLink', () => {
  const link = (relatedEntityType: string | null, relatedEntityId: string | null = 'x1') =>
    notificationLink({ relatedEntityType, relatedEntityId });

  it.each([
    ['MaintenanceAlert', '/alerts?tab=oil'],
    ['GpsIncident', '/alerts/incidents/x1'],
    ['OilChangeSubmission', '/oil-changes/x1'],
    ['MaintenanceRecord', '/maintenance/x1'],
    ['RepairInvoice', '/repair-invoices/x1'],
    ['DriverCharge', '/drivers/charges/x1'],
    ['Document', '/documents'],
  ])('%s → %s', (type, expected) => {
    expect(link(type)).toBe(expected);
  });

  it('falls back to the list page when the id is missing', () => {
    expect(link('GpsIncident', null)).toBe('/alerts?tab=gps');
    expect(link('RepairInvoice', null)).toBe('/repair-invoices');
  });

  it('returns null for unknown or missing types (no navigation)', () => {
    expect(link('Something')).toBeNull();
    expect(link(null)).toBeNull();
  });
});
