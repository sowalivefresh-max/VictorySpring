// reportUtil.js
const classTeacherBanks = {
  excellent: [
    "An outstanding performance! Keep up the excellent work.",
    "A brilliant result. You have shown great dedication.",
    "Exceptional effort and fantastic results. I am proud of you."
  ],
  veryGood: [
    "A very good result. Keep aiming higher.",
    "Great work this term. Continue to push yourself.",
    "Impressive performance. Consistent effort will yield even better results."
  ],
  good: [
    "Good result, but you have the potential to do much better.",
    "A solid effort, but more focus is needed to reach the top.",
    "You have done well, but there is room for improvement next term."
  ],
  fair: [
    "Fair result. More effort and dedication are needed.",
    "An average performance. You need to work harder in your studies.",
    "You passed, but you need to sit up and take your studies seriously."
  ],
  poor: [
    "Poor performance. You must pay more attention in class.",
    "A weak result. Serious improvement is needed next term.",
    "Disappointing performance. You need to focus much more on your academics."
  ]
};

const principalBanks = {
  excellent: [
    "An excellent term's work. The school is proud of you.",
    "Outstanding achievement. Maintain this high standard.",
    "A stellar performance. Keep the flag flying high."
  ],
  veryGood: [
    "Very good result. Keep up the good work and stay focused.",
    "Commendable performance. I encourage you to do even better.",
    "A highly satisfactory result. Continue to aim for the stars."
  ],
  good: [
    "Good effort. With a little more push, you can be among the best.",
    "A satisfactory performance. Strive for excellence next term.",
    "You have done fairly well, but do not rest on your oars."
  ],
  fair: [
    "You need to buckle down and improve on your weak areas.",
    "A marginal performance. I expect a much better result next term.",
    "More dedication to your studies is required for better grades."
  ],
  poor: [
    "This result is unacceptable. You need to wake up to your responsibilities.",
    "Very poor performance. You are advised to take your academics seriously.",
    "A dismal performance. I strongly advise you to work harder."
  ]
};

const getCommentFromBank = (avg, banks, hash) => {
  let category = 'poor';
  if (avg >= 85) category = 'excellent';
  else if (avg >= 70) category = 'veryGood';
  else if (avg >= 60) category = 'good';
  else if (avg >= 50) category = 'fair';
  
  const options = banks[category];
  return options[hash % options.length];
};

async function enrichReportData(dbInstance, reportData, cfg) {
  try {
    let student = reportData.student || {};
    let avg = reportData.summary && reportData.summary.average ? parseFloat(reportData.summary.average) : 0;
    
    // Create a simple deterministic hash based on student info
    const hashStr = (student.fullName || "Student") + (reportData.term || "") + (reportData.session || "");
    let hash = 0;
    for (let i = 0; i < hashStr.length; i++) hash += hashStr.charCodeAt(i);
    
    // Auto-generate comments
    reportData.classTeacherComment = getCommentFromBank(avg, classTeacherBanks, hash);
    reportData.principalComment = getCommentFromBank(avg, principalBanks, hash);
    reportData.headTeacherComment = reportData.principalComment; // Head teacher uses the same bank as principal

    // --- Class Teacher Resolution (Name & Signature) ---
    let teacherNames = [];
    let teacherSignatures = [];

    if (reportData.classTeacherName) teacherNames.push(reportData.classTeacherName);
    if (cfg.class_teacher_name) teacherNames.push(cfg.class_teacher_name);
    if (cfg.class_teacher_signature) teacherSignatures.push(cfg.class_teacher_signature);

    if (student.className && teacherNames.length === 0) {
      const studentClassNorm = (student.className || "").toLowerCase().replace(/[^a-z0-9]/g, "");

      // Source 1: Check `classes` collection by matching normalized className
      try {
        const classesSnap = await dbInstance.collection("classes").get();
        let matchedClassDoc = null;
        classesSnap.forEach(doc => {
          const d = doc.data();
          const cnNorm = (d.className || d.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          if (cnNorm === studentClassNorm) {
            matchedClassDoc = d;
          }
        });

        if (matchedClassDoc) {
          if (matchedClassDoc.classTeacherName) teacherNames.push(matchedClassDoc.classTeacherName);
          if (matchedClassDoc.teacherName) teacherNames.push(matchedClassDoc.teacherName);
          if (matchedClassDoc.classTeacher) teacherNames.push(matchedClassDoc.classTeacher);

          let tIds = matchedClassDoc.classTeacherIds ||
                     (matchedClassDoc.classTeacherId ? [matchedClassDoc.classTeacherId] :
                     (matchedClassDoc.classTeacherID ? [matchedClassDoc.classTeacherID] :
                     (matchedClassDoc.teacherIds || (matchedClassDoc.teacherId ? [matchedClassDoc.teacherId] : []))));
          if (typeof tIds === "string") tIds = tIds.split(",").map(s => s.trim()).filter(Boolean);

          if (Array.isArray(tIds) && tIds.length > 0) {
            for (let tId of tIds) {
              try {
                const uDoc = await dbInstance.collection("users").doc(String(tId)).get();
                if (uDoc.exists) {
                  const uData = uDoc.data();
                  const n = uData.fullName || uData.name || uData.displayName;
                  if (n && !teacherNames.includes(n)) teacherNames.push(n);
                  if (uData.signature && !teacherSignatures.includes(uData.signature)) teacherSignatures.push(uData.signature);
                }
              } catch (e) {}
            }
          }
        }
      } catch (err) {
        console.error("Error fetching class teacher from classes collection:", err);
      }

      // Source 2: Check `users` collection for teachers assigned to this class
      if (teacherNames.length === 0) {
        try {
          const usersSnap = await dbInstance.collection("users").get();
          usersSnap.forEach(doc => {
            const uData = doc.data();
            const role = (uData.role || "").toLowerCase();
            const isTeacherRole = role.includes("teacher") || role === "staff";
            if (!isTeacherRole) return;

            const assigned1 = (uData.classAssigned || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            let matches = (assigned1 && (assigned1 === studentClassNorm || studentClassNorm.includes(assigned1) || assigned1.includes(studentClassNorm)));

            if (!matches && Array.isArray(uData.classesAssigned)) {
              matches = uData.classesAssigned.some(ca => {
                const caNorm = (ca || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                return caNorm === studentClassNorm || studentClassNorm.includes(caNorm) || caNorm.includes(studentClassNorm);
              });
            }

            if (matches) {
              const n = uData.fullName || uData.name || uData.displayName;
              if (n && !teacherNames.includes(n)) teacherNames.push(n);
              if (uData.signature && !teacherSignatures.includes(uData.signature)) teacherSignatures.push(uData.signature);
            }
          });
        } catch (err) {
          console.error("Error finding teacher in users collection:", err);
        }
      }

      // Source 3: Check psychomotor / affective records
      if (teacherNames.length === 0) {
        try {
          const psy = reportData.psychomotor || {};
          const aff = reportData.affective || {};
          const candidateName = psy.teacherName || psy.classTeacherName || psy.submittedByName ||
                                aff.teacherName || aff.classTeacherName || aff.submittedByName;
          if (candidateName) teacherNames.push(candidateName);
          const candidateSig = psy.teacherSignature || psy.signature;
          if (candidateSig) teacherSignatures.push(candidateSig);
        } catch (e) {}
      }

      // Source 4: Check student document fields
      if (teacherNames.length === 0) {
        if (student.classTeacherName) teacherNames.push(student.classTeacherName);
        else if (student.classTeacher) teacherNames.push(student.classTeacher);
      }
    }

    if (teacherNames.length > 0) {
      const finalTeacherName = teacherNames.join(" & ");
      reportData.classTeacherName = finalTeacherName;
      cfg.class_teacher_name = finalTeacherName;
    }
    if (teacherSignatures.length > 0) {
      reportData.classTeacherSignature = teacherSignatures[0];
      cfg.class_teacher_signature = teacherSignatures[0];
    }

    // Fetch principal or headteacher signature based on section
    let sec = (student.section || '').toLowerCase();
    let isPrimary = (!sec || sec === 'primary' || sec === 'primary school' || sec === 'preprimary' || sec === 'nursery' || (student.className && /grade|basic|primary|nursery|kg/i.test(student.className)));
    let roleTarget = isPrimary ? "headteacher" : "principal";

    try {
      const pSnap = await dbInstance.collection("users").get();
      pSnap.forEach(doc => {
        const u = doc.data();
        const r = (u.role || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const targetNorm = roleTarget.replace(/[^a-z0-9]/g, "");
        if ((r === targetNorm || r.includes(targetNorm)) && u.signature) {
          if (isPrimary && !cfg.head_teacher_signature) {
            cfg.head_teacher_signature = u.signature;
          } else if (!isPrimary && !cfg.principal_signature) {
            cfg.principal_signature = u.signature;
          }
        }
      });
    } catch (e) {}

    // --- Resolve Student ID & Age ---
    let stId = student.id || student.studentId || student.studentID || reportData.studentId;

    if (!student.age && !student.dateOfBirth && !student.dob && stId) {
      try {
        const uDoc = await dbInstance.collection("users").doc(String(stId)).get();
        if (uDoc.exists) {
          const uData = uDoc.data();
          if (uData.dateOfBirth) student.dateOfBirth = uData.dateOfBirth;
          if (uData.dob) student.dob = uData.dob;
          if (uData.age) student.age = uData.age;
        }
      } catch (e) {}
    }

    // --- Class Attendance ---
    let present = 0, absent = 0, late = 0;
    let totalDays = 0;

    const matchTerm = (t1, t2) => {
      if (!t1 || !t2) return true;
      const n1 = String(t1).toLowerCase().replace(/[^a-z0-9]/g, '');
      const n2 = String(t2).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (n1 === n2) return true;
      const toNum = s => s.replace(/first|1st/g, '1').replace(/second|2nd/g, '2').replace(/third|3rd/g, '3').replace(/term/g, '');
      return toNum(n1) === toNum(n2);
    };

    const matchSession = (s1, s2) => {
      if (!s1 || !s2) return true;
      const n1 = String(s1).toLowerCase().replace(/[^0-9]/g, '');
      const n2 = String(s2).toLowerCase().replace(/[^0-9]/g, '');
      return n1 === n2;
    };

    if (stId) {
      const studentIdList = [
        stId,
        student.id,
        student.studentId,
        student.studentID,
        student.admissionNumber,
        student.regNo,
        reportData.studentId
      ].filter(Boolean).map(String);
      const uniqueStudentIds = Array.from(new Set(studentIdList));

      const allAttendanceDocs = new Map();

      // 1. Fetch attendance records matching this student's ID(s)
      for (const id of uniqueStudentIds) {
        try {
          const snap = await dbInstance.collection("attendance").where("studentId", "==", id).get();
          snap.forEach(doc => allAttendanceDocs.set(doc.id, doc.data()));
        } catch (e) {}
        try {
          const snap2 = await dbInstance.collection("attendance").where("studentID", "==", id).get();
          snap2.forEach(doc => allAttendanceDocs.set(doc.id, doc.data()));
        } catch (e) {}
      }

      // 2. Fetch attendance records matching this class (casing variants)
      if (student.className) {
        const classVariants = Array.from(new Set([
          student.className,
          student.className.toLowerCase(),
          student.className.toUpperCase(),
          student.className.replace(/\b\w/g, l => l.toUpperCase())
        ])).filter(Boolean);

        for (const cls of classVariants) {
          try {
            const snap = await dbInstance.collection("attendance").where("className", "==", cls).get();
            snap.forEach(doc => allAttendanceDocs.set(doc.id, doc.data()));
          } catch (e) {}
        }
      }

      // 3. Also query by term & session if available
      if (reportData.term && reportData.session) {
        try {
          const snap = await dbInstance.collection("attendance")
            .where("term", "==", reportData.term)
            .where("session", "==", reportData.session)
            .get();
          snap.forEach(doc => allAttendanceDocs.set(doc.id, doc.data()));
        } catch (e) {}
      }

      const normClass = (student.className || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const studentDates = new Set();
      const classDates = new Set();
      const lowerIds = new Set(uniqueStudentIds.map(s => s.toLowerCase()));

      allAttendanceDocs.forEach((d, docId) => {
        if (!matchTerm(d.term, reportData.term) || !matchSession(d.session, reportData.session)) {
          return;
        }

        const recClass = (d.className || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (recClass === normClass && d.date) {
          classDates.add(d.date);
        }

        const recSid = String(d.studentId || d.studentID || '').toLowerCase();
        const recAdm = String(d.admissionNumber || d.admissionNo || '').toLowerCase();
        const isThisStudent = lowerIds.has(recSid) || (recAdm && lowerIds.has(recAdm)) || Array.from(lowerIds).some(id => docId.toLowerCase().startsWith(id + '_'));

        if (isThisStudent) {
          const status = String(d.status || '').toLowerCase();
          if (status === 'present' || status === 'p') present++;
          else if (status === 'absent' || status === 'a') absent++;
          else if (status === 'late' || status === 'l') late++;
          else if (status) present++;

          if (d.date) studentDates.add(d.date);
        }
      });

      // Try classSettings with exact name first, then normalized fallback
      try {
        const cSetSnaps = await Promise.all([
          dbInstance.collection("classSettings").where("className", "==", student.className).get(),
          dbInstance.collection("classSettings").where("className", "==", student.className.toLowerCase()).get(),
          dbInstance.collection("classSettings").where("className", "==", student.className.toUpperCase()).get()
        ]);
        for (const snap of cSetSnaps) {
          for (const doc of snap.docs) {
            const data = doc.data();
            if (matchTerm(data.term, reportData.term) && matchSession(data.session, reportData.session)) {
              if (data.timesSchoolOpened) {
                totalDays = parseInt(data.timesSchoolOpened, 10);
                break;
              }
            }
          }
          if (totalDays > 0) break;
        }
      } catch (e) {}

      // Fallback to class dates, student dates, or marked attendance count
      if (!totalDays || totalDays < (present + absent + late)) {
        totalDays = Math.max(totalDays || 0, classDates.size, studentDates.size, present + absent + late);
      }

      let percentage = totalDays > 0 ? Math.round(((present + late) / totalDays) * 100) : 0;
      reportData.attendance = { present, absent, late, total: totalDays, percentage };
    } else {
      reportData.attendance = { present: 0, absent: 0, late: 0, total: 0, percentage: 0 };
    }

    // --- School Branding & Settings Defaults on cfg ---
    cfg = cfg || {};
    cfg.school_name = cfg.school_name || cfg.schoolName || "VICTORY SPRING SCHOOL";
    cfg.school_motto = cfg.school_motto || cfg.schoolMotto || "VICTORIA AD TENACISSIMOS PERTINET";
    cfg.school_address = cfg.school_address || cfg.schoolAddress || "";
    cfg.school_email = cfg.school_email || cfg.schoolEmail || cfg.smtp_email || "victoryspringschool@gmail.com";
    cfg.school_phone = cfg.school_phone || cfg.schoolPhone || "";
    if (cfg.next_term_begins || cfg.nextTermBegins) {
      reportData.nextTermBegins = cfg.next_term_begins || cfg.nextTermBegins;
    }

    // --- Number in Class & Class Age Average ---
    if (student.className) {
      try {
        const targetCls = (student.className || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const allStudentsSnap = await dbInstance.collection("students").get();
        let classCount = 0;
        let totalStudentAge = 0;
        let countWithAge = 0;

        allStudentsSnap.forEach(doc => {
          const sData = doc.data();
          if (sData.status && sData.status !== "active") return;
          const c1 = (sData.className || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const c2 = (sData.class || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const c3 = (sData.currentClass || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          if (c1 === targetCls || c2 === targetCls || c3 === targetCls) {
            classCount++;
            let age = parseInt(sData.age, 10);
            if (!age && (sData.dob || sData.dateOfBirth)) {
              const d = new Date(sData.dob || sData.dateOfBirth);
              if (!isNaN(d.getTime())) {
                const diff = new Date().getFullYear() - d.getFullYear();
                if (diff > 0 && diff < 100) age = diff;
              }
            }
            if (age && age > 0 && age < 100) {
              totalStudentAge += age;
              countWithAge++;
            }
          }
        });
        if (classCount > 0) reportData.numberInClass = classCount;
        if (countWithAge > 0) reportData.classAgeAverage = (totalStudentAge / countWithAge).toFixed(1) + " Yrs";
      } catch (err) {
        console.error("Error computing class size/age in reportUtil:", err);
      }
    }

    // --- Enrolled Subjects & Assessments Resolution ---
    try {
      const studentIdList = [
        stId,
        student.id,
        student.studentId,
        student.studentID,
        student.admissionNumber,
        student.regNo,
        reportData.studentId
      ].filter(Boolean).map(String);
      const uniqueStudentIds = Array.from(new Set(studentIdList));

      // 1. Fetch all subjects
      const subjectsSnap = await dbInstance.collection("subjects").get();
      const allSubjectsMap = new Map();
      const allSubjectsList = [];
      subjectsSnap.forEach(doc => {
        const subData = doc.data();
        subData.id = doc.id;
        allSubjectsMap.set(doc.id, subData);
        allSubjectsList.push(subData);
      });

      // 2. Fetch enrolled subject IDs for this student from student_subjects
      const enrolledSubjectIds = new Set();
      for (const id of uniqueStudentIds) {
        try {
          const enrollSnap = await dbInstance.collection("student_subjects").where("studentId", "==", id).get();
          enrollSnap.forEach(doc => {
            const d = doc.data();
            if (d.subjectId) enrolledSubjectIds.add(String(d.subjectId));
          });
        } catch (e) {}
      }

      if (Array.isArray(student.enrolledSubjects)) {
        student.enrolledSubjects.forEach(s => enrolledSubjectIds.add(String(typeof s === 'object' ? (s.id || s.subjectId) : s)));
      }
      if (Array.isArray(student.subjects)) {
        student.subjects.forEach(s => enrolledSubjectIds.add(String(typeof s === 'object' ? (s.id || s.subjectId) : s)));
      }

      // 3. Resolve target subjects for this student
      let targetSubjects = [];
      if (enrolledSubjectIds.size > 0) {
        enrolledSubjectIds.forEach(subId => {
          if (allSubjectsMap.has(subId)) {
            targetSubjects.push(allSubjectsMap.get(subId));
          }
        });
      }

      // If student has no specific individual enrollment records in student_subjects,
      // fallback to all subjects configured for their class/section
      if (targetSubjects.length === 0 && student.className) {
        const studentClassNorm = student.className.toLowerCase().replace(/[^a-z0-9]/g, "");
        const studentSecNorm = (student.section || "primary").toLowerCase().trim();

        allSubjectsList.forEach(sub => {
          let classList = sub.className || sub.class || sub.targetClasses || "";
          if (Array.isArray(classList)) classList = classList.join(",");
          const classListNorm = classList.toLowerCase().replace(/[^a-z0-9]/g, "");
          const subSec = (sub.section || "").toLowerCase().trim();

          let match = false;
          if (classListNorm && classListNorm.includes(studentClassNorm)) {
            match = true;
          } else if (!classListNorm && (subSec === studentSecNorm || subSec === "both" || subSec === "")) {
            match = true;
          } else if (classListNorm === "all" || classListNorm === "both") {
            match = true;
          }
          if (match) targetSubjects.push(sub);
        });
      }

      // 4. Gather all existing assessments (scores)
      let combinedScores = Array.isArray(reportData.scores) ? [...reportData.scores] : [];
      const scoreSubjIds = new Set();
      const scoreSubjNames = new Set();

      combinedScores.forEach(s => {
        if (s.subjectId) scoreSubjIds.add(String(s.subjectId));
        if (s.subjectName) scoreSubjNames.add(String(s.subjectName).toLowerCase().trim());
      });

      // Search assessments across all ID aliases for this term and session if needed
      for (const id of uniqueStudentIds) {
        try {
          const assSnap = await dbInstance.collection("assessments").where("studentId", "==", id).get();
          assSnap.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            if (matchTerm(data.term, reportData.term) && matchSession(data.session, reportData.session)) {
              const sId = String(data.subjectId || '');
              const sName = String(data.subjectName || '').toLowerCase().trim();
              if ((!sId || !scoreSubjIds.has(sId)) && (!sName || !scoreSubjNames.has(sName))) {
                combinedScores.push(data);
                if (sId) scoreSubjIds.add(sId);
                if (sName) scoreSubjNames.add(sName);
              }
            }
          });
        } catch (e) {}
      }

      // 5. Merge enrolled subjects that do not have scores yet
      targetSubjects.forEach(sub => {
        const sId = String(sub.id || '');
        const sName = String(sub.subjectName || sub.name || '').toLowerCase().trim();
        const hasScore = (sId && scoreSubjIds.has(sId)) || (sName && scoreSubjNames.has(sName));

        if (!hasScore) {
          combinedScores.push({
            subjectId: sub.id,
            subjectName: sub.subjectName || sub.name || "Subject",
            ca1: "-",
            ca2: "-",
            ca3: "-",
            exam: "-",
            total: "-",
            grade: "-",
            termGrade: "-",
            isEnrolledOnly: true
          });
          if (sId) scoreSubjIds.add(sId);
          if (sName) scoreSubjNames.add(sName);
        }
      });

      // Sort subjects alphabetically for neat presentation
      combinedScores.sort((a, b) => (a.subjectName || "").localeCompare(b.subjectName || ""));

      reportData.scores = combinedScores;

      // Recalculate summary averages based on scored subjects
      let totalMarks = 0;
      let scoredCount = 0;
      combinedScores.forEach(s => {
        let t = Number(s.total || s.termTotal);
        if (!isNaN(t) && s.total !== '-' && s.total !== '' && s.total !== null && s.total !== undefined) {
          totalMarks += t;
          scoredCount++;
        }
      });

      reportData.summary = reportData.summary || {};
      if (scoredCount > 0) {
        reportData.summary.average = Math.round((totalMarks / scoredCount) * 10) / 10;
        reportData.summary.totalMarks = totalMarks;
      }
    } catch (err) {
      console.error("Error resolving enrolled subjects in reportUtil:", err);
    }

    // --- Subject Attendance ---
    if (student.className && reportData.term && reportData.session && reportData.scores && reportData.scores.length > 0 && stId) {
      const subjAttSnap = await dbInstance.collection("subject_attendance")
        .where("className", "==", student.className)
        .where("term", "==", reportData.term)
        .where("session", "==", reportData.session)
        .get();
        
      let subjectDates = {};
      let studentSubjAtt = {};
      
      subjAttSnap.forEach(doc => {
        let d = doc.data();
        if (!d.subjectName || !d.date) return;
        
        if (!subjectDates[d.subjectName]) subjectDates[d.subjectName] = new Set();
        subjectDates[d.subjectName].add(d.date);
        
        if (d.studentId === stId) {
           if (!studentSubjAtt[d.subjectName]) studentSubjAtt[d.subjectName] = 0;
           if (d.status === "Present" || d.status === "Late") studentSubjAtt[d.subjectName]++;
        }
      });
      
      reportData.scores.forEach(score => {
         let sub = score.subjectName;
         if (subjectDates[sub] && subjectDates[sub].size > 0) {
           let totalD = subjectDates[sub].size;
           let pD = studentSubjAtt[sub] || 0;
           score.subjectAttendancePercentage = Math.round((pD / totalD) * 100);
         } else {
           score.subjectAttendancePercentage = null;
         }
      });
    }

  } catch (err) {
    console.error("Error enriching report data:", err);
  }
}

module.exports = { enrichReportData };
