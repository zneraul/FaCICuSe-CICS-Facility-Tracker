/**
 * Canonical Single Source of Truth for verified FaCICuSe project metadata,
 * the canonical 38-facility CICS 5-Floor Building inventory, and BSIT academic block format reference.
 *
 * Pure Domain module (zero Express, React, or database driver dependencies).
 * Populated strictly from verified official project documents:
 *  - Aguilar, Amon, Domingo — Final Project Topic Proposal (WST)
 *  - IT 314 Web System and Technologies — Final Project Guidelines 2026
 */

import { DEFAULT_FACILITY_MEDIA, FACILITY_IMAGE_BY_CODE } from './facilityMedia.js';

export const CICS_BUILDING_NAME = 'CICS Building';

export const CICS_FLOORS = Object.freeze([
  'First Floor',
  'Second Floor',
  'Third Floor',
  'Fourth Floor',
  'Fifth Floor',
]);

export const CICS_CATEGORIES = Object.freeze([
  'Learning',
  'Administrative',
  'Support',
]);

export const CICS_FACILITY_RENAMED_CODES = Object.freeze([
  'CICS-2F-FT',
  'CICS-2F-CONS',
  'CICS-2F-FAC',
  'CICS-2F-MT',
  'CICS-3F-FT',
  'CICS-3F-MT',
  'CICS-4F-TECH',
]);

export const OBSOLETE_GENERIC_FACILITY_CODES = Object.freeze([
  'ARC-101',
  'ENG-304',
  'DES-210',
  'ATH-100',
  'UNI-202',
  'SCI-118',
]);

export const ACADEMIC_BLOCK_REFERENCE = Object.freeze({
  formatPattern: '^IT-[1-4][12]\\d{2}$',
  namingRule: 'IT-<Year Level 1-4><Semester 1 or 2><Two-Digit Block Number>',
  examplesByYear: Object.freeze([
    Object.freeze({ yearLevel: 1, yearLabel: '1st Year', firstSem: 'IT-1109', secondSem: 'IT-1209' }),
    Object.freeze({ yearLevel: 2, yearLabel: '2nd Year', firstSem: 'IT-2109', secondSem: 'IT-2209' }),
    Object.freeze({ yearLevel: 3, yearLabel: '3rd Year', firstSem: 'IT-3106', secondSem: 'IT-3206' }),
    Object.freeze({ yearLevel: 4, yearLabel: '4th Year', firstSem: 'IT-4106', secondSem: 'IT-4206' }),
  ]),
  proposalSampleCodes: Object.freeze(['IT-3106', 'IT-3107']),
  discrepancyNote:
    'Proposal mockup screens (pp. 8, 10, 11) illustrate sample section labels IT-3106 and IT-3107, whereas the supplied BSIT block reference uses suffix 09 for 1st/2nd year (IT-1109..IT-2209) and 06 for 3rd/4th year (IT-3106..IT-4206). No official student roster is available to pre-assign enrolled individuals to blocks.',
});

export const PROJECT_INFO = Object.freeze({
  name: 'FaCICuSe',
  meaning: 'Facility in Use',
  tagline: 'Connected Insights, Coordinated Spaces',
  institution: 'Batangas State University – The National Engineering University, Alangilan Campus',
  institutionShort: 'Batangas State University – Alangilan',
  campusAddress: 'Golden Country Homes, Alangilan, Batangas City, Batangas 4200',
  college: 'College of Informatics and Computing Sciences (CICS)',
  collegeShort: 'CICS',
  course: 'IT 314 — Web System and Technologies (Final Project 2026)',
  timeline: 'December 1–5, 2026',
  contactEmail: 'facicuse@gmail.com',
  copyright: '© 2026 FaCICuSe · Batangas State University – Alangilan (CICS)',
  purpose:
    'Monitoring website for the CICS department facilities in real time that tracks actual room utilization against the scheduled allocation and generates visual data analytics to enhance room management efficiency.',
  buildingScope: Object.freeze({
    label: '5-Floor CICS Building',
    summary: '1 Building · 5 Floors · 38 Facilities',
    buildingCount: 1,
    floorCount: 5,
    facilityCount: 38,
    reservableCount: 26,
    nonReservableCount: 12,
    categoryTotals: Object.freeze({
      Learning: 26,
      Administrative: 7,
      Support: 5,
    }),
  }),
  intendedUsers: Object.freeze(['Students', 'Professors', 'System Administrator']),
  teamRolesSummary: 'Developer & Designer',
  teamMembers: Object.freeze([
    Object.freeze({
      name: 'Hazel C. Aguilar',
      directoryName: 'Aguilar, Hazel C.',
      role: 'Developer & Designer',
    }),
    Object.freeze({
      name: 'Czharrina Mhariell B. Amon',
      directoryName: 'Amon, Czharrina Mhariell B.',
      role: 'Developer & Designer',
    }),
    Object.freeze({
      name: 'Bernardo Laurenz Ulyssys M. Domingo',
      directoryName: 'Domingo, Bernardo Laurenz Ulyssys M.',
      role: 'Developer & Designer',
    }),
  ]),
  unverifiedDetailsNotice:
    'Room seating capacities, specific equipment inventories, degree program details, group number, adviser/instructor name, and per-member role splits are omitted where not verified in the provided proposal or guideline documents.',
});

const IMG_CLASSROOM = DEFAULT_FACILITY_MEDIA.classroom;
const IMG_LAB = DEFAULT_FACILITY_MEDIA.laboratory;
const IMG_SMART = DEFAULT_FACILITY_MEDIA.smartRoom;
const IMG_BUILDING = DEFAULT_FACILITY_MEDIA.building;

function learningRoom(code, floor, name, description, imageUrl = IMG_CLASSROOM) {
  return Object.freeze({
    code,
    name,
    category: 'Learning',
    building: CICS_BUILDING_NAME,
    floor,
    capacity: 40,
    description,
    amenities: '[]',
    status: 'Available',
    allowedRoles: 'student,professor,admin',
    openHour: '07:00',
    closeHour: '20:00',
    imageUrl: FACILITY_IMAGE_BY_CODE[code] || imageUrl,
    isReservable: true,
    isArchived: false,
  });
}

function adminOffice(code, floor, name, description) {
  return Object.freeze({
    code,
    name,
    category: 'Administrative',
    building: CICS_BUILDING_NAME,
    floor,
    capacity: null,
    description,
    amenities: '[]',
    status: 'Restricted',
    allowedRoles: 'admin',
    openHour: '07:00',
    closeHour: '20:00',
    imageUrl: FACILITY_IMAGE_BY_CODE[code] || IMG_SMART,
    isReservable: false,
    isArchived: false,
  });
}

function supportSpace(code, floor, name, description) {
  return Object.freeze({
    code,
    name,
    category: 'Support',
    building: CICS_BUILDING_NAME,
    floor,
    capacity: null,
    description,
    amenities: '[]',
    status: 'Restricted',
    allowedRoles: 'admin',
    openHour: '07:00',
    closeHour: '20:00',
    imageUrl: FACILITY_IMAGE_BY_CODE[code] || IMG_BUILDING,
    isReservable: false,
    isArchived: false,
  });
}

export const CICS_FACILITY_CATALOG = Object.freeze([
  // First Floor (8 facilities: 1 Administrative, 6 Learning, 1 Support)
  adminOffice(
    'CICS-1F-ORG',
    'First Floor',
    'CICS Organizations Office',
    'A space for CICS student organization officers and activities.'
  ),
  learningRoom(
    'CICS-101',
    'First Floor',
    'Room 101',
    'A classroom for lectures, discussions, and learning activities.'
  ),
  learningRoom(
    'CICS-102',
    'First Floor',
    'Room 102',
    'A classroom for lectures, discussions, and learning activities.'
  ),
  learningRoom(
    'CICS-103',
    'First Floor',
    'Room 103',
    'A classroom for lectures, discussions, and learning activities.'
  ),
  learningRoom(
    'CICS-104',
    'First Floor',
    'Room 104',
    'A classroom for lectures, discussions, and learning activities.'
  ),
  learningRoom(
    'CICS-105',
    'First Floor',
    'Room 105',
    'A classroom for lectures, discussions, and learning activities.'
  ),
  learningRoom(
    'CICS-106',
    'First Floor',
    'Room 106',
    'A classroom for lectures, discussions, and learning activities.'
  ),
  supportSpace(
    'CICS-1F-UTIL',
    'First Floor',
    'Utility Room',
    'A storage area for staff maintenance supplies and equipment.'
  ),

  // Second Floor (10 facilities: 2 Support, 2 Learning, 6 Administrative)
  supportSpace(
    'CICS-2F-FT',
    'Second Floor',
    'Female Toilet',
    'A restroom for female students, employees, and building users.'
  ),
  learningRoom(
    'CICS-201',
    'Second Floor',
    'Room 201',
    'A classroom for lectures, discussions, and learning activities.'
  ),
  learningRoom(
    'CICS-202',
    'Second Floor',
    'Room 202',
    'A classroom for lectures, discussions, and learning activities.'
  ),
  adminOffice(
    'CICS-2F-CPE',
    'Second Floor',
    'Computer Engineering Faculty',
    'An office for Computer Engineering faculty members in CICS.'
  ),
  adminOffice(
    'CICS-2F-SAO',
    'Second Floor',
    'CICS Student Services',
    'An office of faculty members for student assistance and inquiries.'
  ),
  adminOffice(
    'CICS-2F-CONS',
    'Second Floor',
    'Consultation Room',
    'An office of faculty members for student academic consultations.'
  ),
  adminOffice(
    'CICS-2F-FAC',
    'Second Floor',
    'CICS Faculty Room',
    'An office for CICS faculty members and academic activities.'
  ),
  adminOffice(
    'CICS-2F-ACC',
    'Second Floor',
    'Accreditation Room',
    'An office for accreditation documentation, coordination, and related activities.'
  ),
  adminOffice(
    'CICS-2F-DEAN',
    'Second Floor',
    "Dean's Office",
    'An office for college administrative tasks and academic affairs.'
  ),
  supportSpace(
    'CICS-2F-MT',
    'Second Floor',
    'All Gender Restroom',
    'A shared restroom for students, employees, and building users.'
  ),

  // Third Floor (8 facilities: 2 Support, 6 Learning)
  supportSpace(
    'CICS-3F-FT',
    'Third Floor',
    'Female Toilet',
    'A restroom for female students, employees, and building users.'
  ),
  learningRoom(
    'CICS-LAB1',
    'Third Floor',
    'Computer Laboratory 1',
    'A laboratory for computer-based learning and technical activities.',
    IMG_LAB
  ),
  learningRoom(
    'CICS-LAB2',
    'Third Floor',
    'Computer Laboratory 2',
    'A laboratory for computer-based learning and technical activities.',
    IMG_LAB
  ),
  learningRoom(
    'CICS-LAB3',
    'Third Floor',
    'Computer Laboratory 3',
    'A laboratory for computer-based learning and technical activities.',
    IMG_LAB
  ),
  learningRoom(
    'CICS-LAB4',
    'Third Floor',
    'Computer Laboratory 4',
    'A laboratory for computer-based learning and technical activities.',
    IMG_LAB
  ),
  learningRoom(
    'CICS-LAB5',
    'Third Floor',
    'Computer Laboratory 5',
    'A laboratory for computer-based learning and technical activities.',
    IMG_LAB
  ),
  learningRoom(
    'CICS-LAB6',
    'Third Floor',
    'Computer Laboratory 6',
    'A laboratory for computer-based learning and technical activities.',
    IMG_LAB
  ),
  supportSpace(
    'CICS-3F-MT',
    'Third Floor',
    'Male Toilet',
    'A restroom for male students, employees, and building users.'
  ),

  // Fourth Floor (6 facilities: 6 Learning)
  learningRoom(
    'CICS-401',
    'Fourth Floor',
    'Room 401',
    'A classroom for lectures, discussions, and learning activities.'
  ),
  learningRoom(
    'CICS-4F-PHYS',
    'Fourth Floor',
    'Physics Laboratory',
    'A laboratory room for physics experiments and demonstrations.',
    IMG_LAB
  ),
  learningRoom(
    'CICS-4F-SMART',
    'Fourth Floor',
    'SMART Classroom',
    'A technology-equipped room for interactive learning and tasks.',
    IMG_SMART
  ),
  learningRoom(
    'CICS-4F-EDL',
    'Fourth Floor',
    'Electronics Distance Learning',
    'A classroom for electronics instruction and distance learning.',
    IMG_SMART
  ),
  learningRoom(
    'CICS-4F-TECH',
    'Fourth Floor',
    'Technicians’ Room',
    'A laboratory for technical exercises, experiments, and lessons.',
    IMG_LAB
  ),
  learningRoom(
    'CICS-4F-ITL',
    'Fourth Floor',
    'Information Technology Laboratory',
    'A laboratory for IT lessons and computing practical activities.',
    IMG_LAB
  ),

  // Fifth Floor (6 facilities: 6 Learning)
  learningRoom(
    'CICS-501',
    'Fifth Floor',
    'Room 501',
    'A classroom for lectures, discussions, and learning activities.'
  ),
  learningRoom(
    'CICS-502',
    'Fifth Floor',
    'Room 502',
    'A classroom for lectures, discussions, and learning activities.'
  ),
  learningRoom(
    'CICS-503',
    'Fifth Floor',
    'Room 503',
    'A classroom for lectures, discussions, and learning activities.'
  ),
  learningRoom(
    'CICS-504',
    'Fifth Floor',
    'Room 504',
    'A classroom for lectures, discussions, and learning activities.'
  ),
  learningRoom(
    'CICS-505',
    'Fifth Floor',
    'Room 505',
    'A classroom for lectures, discussions, and learning activities.'
  ),
  learningRoom(
    'CICS-506',
    'Fifth Floor',
    'Room 506',
    'A classroom for lectures, discussions, and learning activities.'
  ),
]);

export function getPublicProjectInfo() {
  return {
    project: PROJECT_INFO,
    cicsFacilities: CICS_FACILITY_CATALOG,
    academicBlockReference: ACADEMIC_BLOCK_REFERENCE,
  };
}
