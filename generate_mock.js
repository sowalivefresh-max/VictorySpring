const fs = require('fs');
const pdf = require('./functions/actions/pdf.js');

const mockReport = {
  reportType: 'full',
  term: 'First Term',
  session: '2024/2025',
  student: {
    fullName: 'Jane Doe',
    admissionNumber: 'VS/2024/001',
    gender: 'Female',
    className: 'Grade 3',
    dob: '12 May 2015',
  },
  attendance: {
    total: 110,
    present: 108,
    percentage: 98
  },
  summary: {
    average: 89.5,
    overallGrade: 'A'
  },
  scores: [
    { subjectName: 'Mathematics', ca1: 10, ca2: 10, ca3: 8, exam: 58, termTotal: 86, grade: 'A', subjectAttendancePercentage: 100 },
    { subjectName: 'English Language', ca1: 8, ca2: 9, ca3: 9, exam: 55, termTotal: 81, grade: 'B', subjectAttendancePercentage: 98 },
    { subjectName: 'Basic Science', ca1: 9, ca2: 10, ca3: 10, exam: 59, termTotal: 88, grade: 'A', subjectAttendancePercentage: 100 },
    { subjectName: 'Civic Education', ca1: 10, ca2: 10, ca3: 10, exam: 50, termTotal: 80, grade: 'B', subjectAttendancePercentage: 100 },
    { subjectName: 'Quantitative Reasoning', ca1: 7, ca2: 8, ca3: 8, exam: 45, termTotal: 68, grade: 'C', subjectAttendancePercentage: 100 }
  ],
  psychomotor: {
    hp_punctuality: 'A', hp_neatness: 'A', hp_ptc: 'B', hp_hw_quality: 'A', hp_hw_prompt: 'A',
    cd_polite: 'A', cd_independent: 'B', cd_adults: 'A', cd_behaviour: 'A', cd_curious: 'A', cd_active: 'B', cd_collaborates: 'A', cd_perseveres: 'B', cd_effort: 'A', cd_leadership: 'C', cd_presentation: 'B',
    os_music: 'A', os_pe: 'A', os_swimming: 'B', os_library: 'A', os_handwriting: 'B', os_chess: 'NA', os_diction: 'A', os_project: 'A',
    en_computer: 'A', en_french: 'B', en_arts: 'A', en_taekwando: 'NA', en_ballet: 'NA', en_leadership: 'B', en_robotics: 'C', en_music: 'A', en_sports: 'B', en_reading: 'A', en_chess: 'NA', en_etiquette: 'A'
  },
  classTeacherComment: 'Jane is an exceptional student. Keep it up!',
  principalComment: 'A very brilliant term.',
  classTeacherName: 'Mr. John Smith'
};

const mockCfg = {
  schoolName: 'VICTORY SPRING SCHOOL',
  schoolMotto: 'Nurturing Future Leaders',
  schoolAddress: '123 Spring Avenue, City',
  class_teacher_name: 'Mr. John Smith',
  class_teacher_signature: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Signature_of_John_Hancock.svg',
  principal_signature: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/George_Washington_signature.svg'
};

const html = pdf.generateStudentReportHTML(mockReport, mockCfg);

fs.writeFileSync('mock_report.html', html);
console.log('Mock report generated at mock_report.html');
