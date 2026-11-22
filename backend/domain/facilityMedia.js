/**
 * Centralized Facility Media Registry for FaCICuSe (CICS Building).
 * Approved original photographs remain organized in floor-specific folders.
 * Keep filenames, capitalization, spaces, and extensions aligned with the assets.
 */

export const DEFAULT_FACILITY_MEDIA = Object.freeze({
  classroom: '/assets/images/facilities/1st Floor/Room 101.jpeg',
  laboratory: '/assets/images/facilities/3rd Floor/Computer Laboratory 1.jpeg',
  smartRoom: '/assets/images/facilities/4th Floor/SMART Classroom.jpeg',
  building: '/assets/images/facilities/Building/Wider.jpeg',
});

export const FACILITY_MEDIA_PRESETS = Object.freeze([
  Object.freeze({ id: 'classroom', label: 'CICS Classroom (Fallback)', value: DEFAULT_FACILITY_MEDIA.classroom }),
  Object.freeze({ id: 'laboratory', label: 'CICS Laboratory (Fallback)', value: DEFAULT_FACILITY_MEDIA.laboratory }),
  Object.freeze({ id: 'smartRoom', label: 'CICS SMART Room (Fallback)', value: DEFAULT_FACILITY_MEDIA.smartRoom }),
  Object.freeze({ id: 'building', label: 'CICS Building (Fallback)', value: DEFAULT_FACILITY_MEDIA.building }),
]);

const FLOOR_PHOTO = (floor, filename) =>
  `/assets/images/facilities/${floor}/${filename}`;

/** Canonical facility code -> exact approved source photograph path. */
export const FACILITY_IMAGE_BY_CODE = Object.freeze({
  'CICS-1F-ORG': FLOOR_PHOTO('1st Floor', 'CICS Organizations Office.jpeg'),
  'CICS-101': FLOOR_PHOTO('1st Floor', 'Room 101.jpeg'),
  'CICS-102': FLOOR_PHOTO('1st Floor', 'Room 102.jpeg'),
  'CICS-103': FLOOR_PHOTO('1st Floor', 'Room 103.jpeg'),
  'CICS-104': FLOOR_PHOTO('1st Floor', 'Room 104.jpeg'),
  'CICS-105': FLOOR_PHOTO('1st Floor', 'Room 105.jpeg'),
  'CICS-106': FLOOR_PHOTO('1st Floor', 'Room 106.jpeg'),
  'CICS-1F-UTIL': FLOOR_PHOTO('1st Floor', 'Utility Room.jpeg'),

  'CICS-2F-FT': FLOOR_PHOTO('2nd Floor', 'Female Toilet.jpeg'),
  'CICS-2F-MT': FLOOR_PHOTO('2nd Floor', 'All Gender Restroom.jpeg'),
  'CICS-2F-ACC': FLOOR_PHOTO('2nd Floor', 'Accreditation Room.jpeg'),
  'CICS-201': FLOOR_PHOTO('2nd Floor', 'Room 201.jpeg'),
  'CICS-202': FLOOR_PHOTO('2nd Floor', 'Room 202.jpeg'),
  'CICS-2F-CPE': FLOOR_PHOTO('2nd Floor', 'Computer Engineering Faculty.jpeg'),
  'CICS-2F-SAO': FLOOR_PHOTO('2nd Floor', 'CICS Student Services.jpeg'),
  'CICS-2F-CONS': FLOOR_PHOTO('2nd Floor', 'Consultation Room.jpeg'),
  'CICS-2F-FAC': FLOOR_PHOTO('2nd Floor', 'CICS Faculty Room.jpeg'),
  'CICS-2F-DEAN': FLOOR_PHOTO('2nd Floor', 'Dean_s Office.jpeg'),

  'CICS-3F-FT': FLOOR_PHOTO('3rd Floor', 'Female Toilet.jpeg'),
  'CICS-LAB1': FLOOR_PHOTO('3rd Floor', 'Computer Laboratory 1.jpeg'),
  'CICS-LAB2': FLOOR_PHOTO('3rd Floor', 'Computer Laboratory 2.jpeg'),
  'CICS-LAB3': FLOOR_PHOTO('3rd Floor', 'Computer Laboratory 3.jpeg'),
  'CICS-LAB4': FLOOR_PHOTO('3rd Floor', 'Computer Laboratory 4.jpeg'),
  'CICS-LAB5': FLOOR_PHOTO('3rd Floor', 'Computer Laboratory 5.jpeg'),
  'CICS-LAB6': FLOOR_PHOTO('3rd Floor', 'Computer Laboratory 6.jpeg'),
  'CICS-3F-MT': FLOOR_PHOTO('3rd Floor', 'Male Toilet.jpeg'),

  'CICS-401': FLOOR_PHOTO('4th Floor', 'Room 401.jpeg'),
  'CICS-4F-PHYS': FLOOR_PHOTO('4th Floor', 'Physics Laboratory.jpeg'),
  'CICS-4F-SMART': FLOOR_PHOTO('4th Floor', 'SMART Classroom.jpeg'),
  'CICS-4F-EDL': FLOOR_PHOTO('4th Floor', 'Electronics Distance Learning.jpeg'),
  'CICS-4F-TECH': FLOOR_PHOTO('4th Floor', 'Technicians’ Room.jpeg'),
'CICS-4F-ITL': FLOOR_PHOTO('4th Floor', 'Information Technology Laboratory.jpeg'),

  'CICS-501': FLOOR_PHOTO('5th Floor', 'Room 501.jpeg'),
  'CICS-502': FLOOR_PHOTO('5th Floor', 'Room 502.jpeg'),
  'CICS-503': FLOOR_PHOTO('5th Floor', 'Room 503.jpeg'),
  'CICS-504': FLOOR_PHOTO('5th Floor', 'Room 504.jpeg'),
  'CICS-505': FLOOR_PHOTO('5th Floor', 'Room 505.jpeg'),
  'CICS-506': FLOOR_PHOTO('5th Floor', 'Room 506.jpeg'),
});

const DEFAULT_IMAGE_VALUES = new Set(Object.values(DEFAULT_FACILITY_MEDIA));

export function resolveFacilityImageUrl({ code, category, imageUrl } = {}) {
  const custom = String(imageUrl || '').trim();
  const normalizedCode = String(code || '').trim().toUpperCase();
  const matchedPhoto = normalizedCode ? FACILITY_IMAGE_BY_CODE[normalizedCode] : null;

  if (matchedPhoto && (!custom || DEFAULT_IMAGE_VALUES.has(custom))) return matchedPhoto;
  if (custom) return custom;
  if (matchedPhoto) return matchedPhoto;

  if (category === 'Administrative') return DEFAULT_FACILITY_MEDIA.smartRoom;
  if (category === 'Support') return DEFAULT_FACILITY_MEDIA.building;
  return DEFAULT_FACILITY_MEDIA.classroom;
}
