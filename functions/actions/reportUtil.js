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

    // Fetch class teacher signature
    if (student.className) {
      const classSnap = await dbInstance.collection("classes").where("className", "==", student.className).limit(1).get();
      if (!classSnap.empty) {
        let classData = classSnap.docs[0].data();
        let tIds = classData.classTeacherIds || (classData.classTeacherId ? [classData.classTeacherId] : []);
        if (tIds.length > 0) {
          let signatures = [];
          let names = [];
          for (let tId of tIds) {
            const ctSnap = await dbInstance.collection("users").doc(tId).get();
            if (ctSnap.exists) {
              let ctData = ctSnap.data();
              if (ctData.signature) signatures.push(ctData.signature);
              if (ctData.fullName) names.push(ctData.fullName);
            }
          }
          if (signatures.length > 0) cfg.class_teacher_signature = signatures[0];
          if (names.length > 0) cfg.class_teacher_name = names.join(" & ");
        }
      }
    }

    // Fetch principal or headteacher signature based on section
    let sec = (student.section || '').toLowerCase();
    let isPrimary = (sec === 'primary' || sec === 'primary school' || sec === 'preprimary' || sec === 'nursery');
    let roleTarget = isPrimary ? "headteacher" : "principal";

    const pSnap = await dbInstance.collection("users").where("role", "==", roleTarget).limit(1).get();
    if (!pSnap.empty && pSnap.docs[0].data().signature) {
      if (isPrimary) {
        cfg.head_teacher_signature = pSnap.docs[0].data().signature;
      } else {
        cfg.principal_signature = pSnap.docs[0].data().signature;
      }
    }

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
