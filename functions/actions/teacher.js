module.exports = function(db, notificationsActions) {
  async function getTeacherClass(userId) {
    const userDoc = await db.collection("users").doc(userId).get();
    let cls = userDoc.exists ? userDoc.data().classAssigned : null;
    if (!cls) {
      const snap1 = await db.collection("classes").where("classTeacherId", "==", userId).get();
      const snap2 = await db.collection("classes").where("classTeacherIds", "array-contains", userId).get();
      if (!snap1.empty) cls = snap1.docs[0].data().className;
      else if (!snap2.empty) cls = snap2.docs[0].data().className;
    }
    return cls;
  }

  let cachedLogoBase64 = null;
  function getSchoolLogoBase64() {
    if (cachedLogoBase64) return cachedLogoBase64;
    try {
      const fs = require("fs");
      const path = require("path");
      const iconPath = path.join(__dirname, "../icon.png");
      if (fs.existsSync(iconPath)) {
        cachedLogoBase64 = "data:image/png;base64," + fs.readFileSync(iconPath).toString("base64");
        return cachedLogoBase64;
      }
    } catch (e) {
      console.error("Error reading icon.png:", e);
    }
    return "";
  }

  return {
    teacherGetMySubjects: async (req, res) => {
      const session = req.session;
      const userId = session.userId;

      try {
        // Get the class this teacher is assigned to (works for any role)
        const myClass = (await getTeacherClass(userId)) || "";
        const myClassNormalized = myClass.toLowerCase().trim();

        // If they have a class, look up the section of that class from the classes collection
        let myClassSection = "";
        if (myClassNormalized) {
          const classesSnap = await db.collection("classes").get();
          classesSnap.forEach(doc => {
            const cn = (doc.data().className || "").toLowerCase().trim();
            if (cn === myClassNormalized) {
              myClassSection = (doc.data().section || "").toLowerCase().trim();
            }
          });
        }

        const subjectsSnap = await db.collection("subjects").get();
        const subjects = [];

        subjectsSnap.forEach(doc => {
          let sub = doc.data();
          sub.id = doc.id;

          const subSection = (sub.section || "").toLowerCase().trim();
          const tId = sub.assignedTeacherId || sub.teacherId;

          // Resolve target class field (multiple naming conventions)
          let classList = sub.className || sub.class || sub.targetClasses || "";
          if (Array.isArray(classList)) classList = classList.join(",");
          const classListNormalized = classList.toLowerCase().trim();
          
          // Split comma-separated class list for exact matching
          const classListItems = classListNormalized
            ? classListNormalized.split(/[,;]/).map(c => c.trim()).filter(Boolean)
            : [];

          let isMySubject = false;

          // Priority 1: Explicitly assigned to this teacher
          if (tId && String(tId) === String(userId)) {
            isMySubject = true;
          }
          // Priority 2: Subject targets teacher's specific class (case-insensitive exact match)
          else if (myClassNormalized && classListItems.length > 0 &&
                   classListItems.some(c => c === myClassNormalized)) {
            isMySubject = true;
          }
          // Priority 3: No specific class restriction and section matches teacher's class section
          else if (myClassNormalized && classListItems.length === 0 &&
                   myClassSection &&
                   (subSection === myClassSection || subSection === "both" || subSection === "")) {
            isMySubject = true;
          }
          // Priority 4: Subject explicitly targets 'all' or 'both'
          else if (classListNormalized === "all" || classListNormalized === "both") {
            isMySubject = true;
          }

          if (isMySubject) {
            subjects.push(sub);
          }
        });
        return res.json({ success: true, data: subjects });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching subjects: " + err.message });
      }
    },

    teacherGetStudentCount: async (req, res) => {
      const userId = req.session.userId;
      const role = req.session.role;
      try {
        let studentCount = 0;
        if (role === 'primary_teacher') {
          const myClass = await getTeacherClass(userId);
          if (myClass) {
            // Case-insensitive student count
            const myClassLower = myClass.toLowerCase().trim();
            const allStudentsSnap = await db.collection("students").get();
            allStudentsSnap.forEach(doc => {
              const cn = doc.data().className || '';
              if (cn.toLowerCase().trim() === myClassLower) studentCount++;
            });
          }
        } else {
          const subSnap = await db.collection("subjects").get();
          const subjectIds = [];
          subSnap.forEach(d => {
            const sub = d.data();
            const tId = sub.assignedTeacherId || sub.teacherId;
            if (tId && String(tId) === String(userId)) {
              subjectIds.push(d.id);
            }
          });
          if (subjectIds.length > 0) {
            let uniqueStudents = new Set();
            for (let i = 0; i < subjectIds.length; i += 30) {
              const chunk = subjectIds.slice(i, i + 30);
              const enrollSnap = await db.collection("student_subjects").where("subjectId", "in", chunk).get();
              enrollSnap.forEach(doc => uniqueStudents.add(doc.data().studentId));
            }
            studentCount = uniqueStudents.size;
          }
        }
        return res.json({ success: true, data: studentCount });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    teacherGetClassStudents: async (req, res) => {
      const className = req.body.className;
      if (!className) return res.json({ success: false, message: "Class name required." });
      const classNameLower = className.toLowerCase().trim();
      
      try {
        // Fetch all active students and filter case-insensitively
        const studentsSnap = await db.collection("students")
          .where("status", "==", "active")
          .get();
          
        const target = className.toLowerCase().replace(/[^a-z0-9]/g, "");
        const students = [];
        studentsSnap.forEach(doc => {
          let st = doc.data();
          const c1 = (st.className || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const c2 = (st.class || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const c3 = (st.currentClass || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          if (c1 === target || c2 === target || c3 === target) {
            st.id = doc.id;
            students.push(st);
          }
        });
        
        return res.json({ success: true, data: students });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching students: " + err.message });
      }
    },

    teacherGetStudentSubjects: async (req, res) => {
      try {
        const sid = req.body.studentId;
        if (!sid) return res.json({ success: false, message: "Student ID required" });
        
        const userId = req.session.userId;
        const teacherClass = await getTeacherClass(userId);
        if (!teacherClass) return res.json({ success: false, message: "You are not assigned as a class teacher." });
        
        const teacherClassNormalized = teacherClass.toLowerCase().trim();
        
        // Fetch teacher's class section
        let myClassSection = "";
        const classesSnap = await db.collection("classes").get();
        classesSnap.forEach(doc => {
          if ((doc.data().className || "").toLowerCase().trim() === teacherClassNormalized) {
            myClassSection = (doc.data().section || "").toLowerCase().trim();
          }
        });

        const studentDoc = await db.collection("students").doc(sid).get();
        const studentClassSS = studentDoc.exists ? (studentDoc.data().className || '') : '';
        if (!studentDoc.exists || studentClassSS.toLowerCase().trim() !== teacherClassNormalized) {
          return res.json({ success: false, message: "Student not found in your assigned class." });
        }
        
        // Fetch ALL subjects and filter to those applicable to the class
        const subjectsSnap = await db.collection("subjects").get();
        const classSubjects = [];
        
        subjectsSnap.forEach(doc => {
          let sub = doc.data();
          sub.id = doc.id;
          
          const subSection = (sub.section || "").toLowerCase().trim();
          const tId = sub.assignedTeacherId || sub.teacherId;
          
          let classList = sub.className || sub.class || sub.targetClasses || "";
          if (Array.isArray(classList)) classList = classList.join(",");
          const classListNormalized = classList.toLowerCase().trim();
          
          const classListItems = classListNormalized
            ? classListNormalized.split(/[,;]/).map(c => c.trim()).filter(Boolean)
            : [];
            
          let isMySubject = false;
          
          if (tId && String(tId) === String(userId)) {
            isMySubject = true;
          } else if (teacherClassNormalized && classListItems.length > 0 && classListItems.some(c => c === teacherClassNormalized)) {
            isMySubject = true;
          } else if (teacherClassNormalized && classListItems.length === 0 && myClassSection && (subSection === myClassSection || subSection === "both" || subSection === "")) {
            isMySubject = true;
          } else if (classListNormalized === "all" || classListNormalized === "both") {
            isMySubject = true;
          }
          
          if (isMySubject) classSubjects.push(sub);
        });
        
        const enrollSnap = await db.collection("student_subjects").where("studentId", "==", sid).get();
        const enrolledIds = enrollSnap.docs.map(d => d.data().subjectId);
        
        const enrolled = classSubjects.filter(s => enrolledIds.includes(s.id));
        const available = classSubjects.filter(s => !enrolledIds.includes(s.id));
        
        return res.json({ success: true, data: { enrolled, available } });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    teacherGetSubjectStudents: async (req, res) => {
      try {
        const { subjectId, session, term } = req.body;
        if (!subjectId) return res.json({ success: false, message: "Subject ID required" });

        // 1. Get enrollments for this subject
        let query = db.collection("student_subjects").where("subjectId", "==", subjectId);
        if (session) query = query.where("session", "==", session);
        if (term) query = query.where("term", "==", term);

        const enrollSnap = await query.get();
        if (enrollSnap.empty) return res.json({ success: true, data: [] });
        
        const studentIds = enrollSnap.docs.map(d => d.data().studentId);
        
        // 2. Fetch the student details for these IDs
        const studentsSnap = await db.collection("students").where("status", "==", "active").get();
        const students = [];
        studentsSnap.forEach(doc => {
          if (studentIds.includes(doc.id)) {
            let st = doc.data();
            st.id = doc.id;
            students.push(st);
          }
        });
        
        return res.json({ success: true, data: students });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    teacherEnrollStudent: async (req, res) => { 
      try {
        const { studentId, subjectId, session, term } = req.body;
        if (!studentId || !subjectId) return res.json({ success: false, message: "Student and Subject ID required" });
        
        const teacherClass = await getTeacherClass(req.session.userId);
        const studentDoc = await db.collection("students").doc(studentId).get();
        const studentClassEN = studentDoc.exists ? (studentDoc.data().className || '') : '';
        if (!studentDoc.exists || studentClassEN.toLowerCase().trim() !== (teacherClass || '').toLowerCase().trim()) {
          return res.json({ success: false, message: "Student not found in your assigned class." });
        }
        
        const existing = await db.collection("student_subjects")
          .where("studentId", "==", studentId)
          .where("subjectId", "==", subjectId).get();
          
        if (!existing.empty) return res.json({ success: false, message: "Student already enrolled in this subject" });
        
        await db.collection("student_subjects").add({
          studentId, subjectId, session, term, enrolledAt: new Date().toISOString()
        });
        return res.json({ success: true, message: "Student enrolled successfully." });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },

    teacherUnenrollStudent: async (req, res) => { 
      try {
        const { studentId, subjectId } = req.body;
        if (!studentId || !subjectId) return res.json({ success: false, message: "Student and Subject ID required" });
        
        const teacherClass = await getTeacherClass(req.session.userId);
        const studentDocU = await db.collection("students").doc(studentId).get();
        const studentClassUE = studentDocU.exists ? (studentDocU.data().className || '') : '';
        if (!studentDocU.exists || studentClassUE.toLowerCase().trim() !== (teacherClass || '').toLowerCase().trim()) {
          return res.json({ success: false, message: "Student not found in your assigned class." });
        }
        
        const existing = await db.collection("student_subjects")
          .where("studentId", "==", studentId)
          .where("subjectId", "==", subjectId).get();
          
        if (existing.empty) return res.json({ success: false, message: "Enrollment not found" });
        
        const batch = db.batch();
        existing.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        
        return res.json({ success: true, message: "Student unenrolled successfully." });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },

    teacherGetScores: async (req, res) => {
      const filters = req.body.filters || {};
      const session = req.session;
      
      if (!filters.subjectId) {
        filters.teacherId = session.userId;
      }
      
      try {
        let query = db.collection("assessments");
        
        if (filters.subjectId) query = query.where("subjectId", "==", filters.subjectId);
        if (filters.teacherId) query = query.where("teacherId", "==", filters.teacherId);
        if (filters.className) query = query.where("className", "==", filters.className);
        if (filters.term) query = query.where("term", "==", filters.term);
        if (filters.session) query = query.where("session", "==", filters.session);
        
        const scoresSnap = await query.get();
        const scores = [];
        scoresSnap.forEach(doc => {
          let s = doc.data();
          s.id = doc.id;
          scores.push(s);
        });
        
        return res.json({ success: true, data: scores });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching scores: " + err.message });
      }
    },
    
    teacherGetLessonPlans: async (req, res) => {
      const session = req.session;
      try {
        let query = db.collection("lessonPlans");
        if (session && session.userId && session.role !== "admin" && session.role !== "developer") {
          query = query.where("teacherId", "==", session.userId);
        }
        const plansSnap = await query.get();
          
        const plans = [];
        plansSnap.forEach(doc => {
          let p = doc.data();
          p.id = doc.id;
          plans.push(p);
        });
        plans.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        
        return res.json({ success: true, data: plans });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching lesson plans: " + err.message });
      }
    },

    teacherSaveScore: async (req, res) => {
      if(req.session) { db.collection("audit_logs").add({ timestamp: new Date().toISOString(), userId: req.session.userId, userName: req.session.fullName || "User", action: "EDIT_GRADEBOOK", details: `Updated gradebook score for student ${req.body.data ? req.body.data.studentId : "unknown"}` }).catch(()=>{}); }
      const data = req.body.data;
      if (!data || !data.studentId || !data.subjectId) {
        return res.json({ success: false, message: "Student ID and Subject ID required." });
      }
      
      try {
        if (data.id) {
          await db.collection("assessments").doc(data.id).update(data);
          return res.json({ success: true, message: "Score updated successfully." });
        } else {
          // Verify existing score
          const existingSnap = await db.collection("assessments")
            .where("studentId", "==", data.studentId)
            .where("subjectId", "==", data.subjectId)
            .where("term", "==", data.term)
            .where("session", "==", data.session)
            .get();
            
          if (!existingSnap.empty) {
            await db.collection("assessments").doc(existingSnap.docs[0].id).update(data);
            return res.json({ success: true, message: "Score updated successfully." });
          } else {
            const newRef = db.collection("assessments").doc();
            data.id = newRef.id;
            await newRef.set(data);
            return res.json({ success: true, message: "Score saved successfully." });
          }
        }
      } catch (err) {
        return res.json({ success: false, message: "Error saving score: " + err.message });
      }
    },

    teacherBulkSaveScores: async (req, res) => {
      if(req.session) { db.collection("audit_logs").add({ timestamp: new Date().toISOString(), userId: req.session.userId, userName: req.session.fullName || "User", action: "EDIT_GRADEBOOK", details: `Bulk updated gradebook scores` }).catch(()=>{}); }
      const scores = req.body.data;
      if (!scores || !Array.isArray(scores) || scores.length === 0) {
        return res.json({ success: false, message: "No score data provided." });
      }

      try {
        const batch = db.batch();
        let count = 0;
        
        for (let data of scores) {
          if (!data.studentId || !data.subjectId) continue;
          
          if (data.id) {
            batch.update(db.collection("assessments").doc(data.id), data);
          } else {
            const existingSnap = await db.collection("assessments")
              .where("studentId", "==", data.studentId)
              .where("subjectId", "==", data.subjectId)
              .where("term", "==", data.term)
              .where("session", "==", data.session)
              .get();
              
            if (!existingSnap.empty) {
              batch.update(db.collection("assessments").doc(existingSnap.docs[0].id), data);
            } else {
              const newRef = db.collection("assessments").doc();
              data.id = newRef.id;
              batch.set(newRef, data);
            }
          }
          count++;
        }
        
        if (count > 0) {
          await batch.commit();
          
          // Trigger notifications to parents in the background (fire and forget)
          if (notificationsActions) {
            // Deduplicate by studentId to prevent spam
            const uniqueStudentIds = [...new Set(scores.map(s => s.studentId).filter(Boolean))];
            uniqueStudentIds.forEach(async (sid) => {
              try {
                const studentDoc = await db.collection("students").doc(sid).get();
                if (studentDoc.exists && studentDoc.data().parentId) {
                  const student = studentDoc.data();
                  // We pick the first score data for term info
                  const meta = scores.find(s => s.studentId === sid);
                  notificationsActions.createNotification(
                    student.parentId,
                    "Exam Results Updated",
                    `New results have been uploaded/updated for ${student.fullName || 'your child'} (${meta.term || ''}, ${meta.session || ''}).`,
                    "RESULT"
                  );
                }
              } catch (e) {
                console.error("Failed to trigger result notification for", sid, e);
              }
            });
          }
        }
        return res.json({ success: true, message: `${count} scores saved successfully.` });
      } catch (err) {
        return res.json({ success: false, message: "Error saving bulk scores: " + err.message });
      }
    },

    teacherSaveLessonPlan: async (req, res) => {
      const session = req.session;
      if (session) {
        db.collection("audit_logs").add({
          timestamp: new Date().toISOString(),
          userId: session.userId,
          userName: session.fullName || "User",
          action: "UPLOAD_LESSON_NOTE",
          details: "Uploaded/Saved lesson note"
        }).catch(() => {});
      }
      const data = req.body.data || {};
      const topic = data.topic || data.title;
      
      if (!topic) {
        return res.json({ success: false, message: "Lesson Topic is required." });
      }

      try {
        const planData = {
          ...data,
          topic: topic,
          title: topic,
          updatedAt: new Date().toISOString()
        };

        if (session && session.userId) {
          planData.teacherId = planData.teacherId || session.userId;
          planData.teacherName = planData.teacherName || session.fullName || "Teacher";
          if (!planData.className && !planData.class) {
            try {
              planData.className = (await getTeacherClass(session.userId)) || "";
              planData.class = planData.className;
            } catch(e) {}
          }
        }

        if (planData.className && !planData.class) planData.class = planData.className;
        if (planData.class && !planData.className) planData.className = planData.class;

        if (!planData.subjectName && planData.subjectId) {
          try {
            const sDoc = await db.collection("subjects").doc(planData.subjectId).get();
            if (sDoc.exists) {
              planData.subjectName = sDoc.data().subjectName || sDoc.data().name || "";
            }
          } catch(e) {}
        }
        if (planData.subjectName && !planData.subject) planData.subject = planData.subjectName;
        if (planData.subject && !planData.subjectName) planData.subjectName = planData.subject;

        // If subjectName is still missing, infer from reference book or topic
        if (!planData.subjectName) {
          const hint = ((planData.referenceBook || "") + " " + (planData.topic || "")).toLowerCase();
          if (hint.includes("math") || hint.includes("place value") || hint.includes("number") || hint.includes("addition") || hint.includes("fraction")) {
            planData.subjectName = "Mathematics";
            planData.subject = "Mathematics";
          } else if (hint.includes("english") || hint.includes("grammar") || hint.includes("phonics") || hint.includes("comprehension")) {
            planData.subjectName = "English Language";
            planData.subject = "English Language";
          } else if (hint.includes("science")) {
            planData.subjectName = "Basic Science";
            planData.subject = "Basic Science";
          }
        }

        // If className is still missing, infer from reference book
        if (!planData.className && planData.referenceBook) {
          const match = planData.referenceBook.match(/Primary\s*([0-9]|one|two|three|four|five|six)/i);
          if (match) {
            planData.className = "Primary " + match[1];
            planData.class = planData.className;
          } else if (/primary/i.test(planData.referenceBook)) {
            planData.className = "Primary";
            planData.class = "Primary";
          }
        }

        if (data.id) {
          await db.collection("lessonPlans").doc(data.id).update(planData);
          return res.json({ success: true, id: data.id, message: "Lesson plan updated." });
        } else {
          const newRef = db.collection("lessonPlans").doc();
          planData.id = newRef.id;
          planData.createdAt = new Date().toISOString();
          planData.status = data.status || "draft";
          await newRef.set(planData);
          return res.json({ success: true, id: newRef.id, message: "Lesson plan saved successfully." });
        }
      } catch (err) {
        return res.json({ success: false, message: "Error saving lesson plan: " + err.message });
      }
    },

    teacherSubmitLessonPlan: async (req, res) => {
      const session = req.session;
      const planId = req.body.planId || req.body.id;
      if (!planId) return res.json({ success: false, message: "Plan ID is required." });
      try {
        const planRef = db.collection("lessonPlans").doc(planId);
        const planDoc = await planRef.get();
        if (!planDoc.exists) return res.json({ success: false, message: "Lesson plan not found." });
        
        await planRef.update({
          status: "submitted",
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        
        if (session) {
          db.collection("audit_logs").add({
            timestamp: new Date().toISOString(),
            userId: session.userId,
            userName: session.fullName || "Teacher",
            action: "SUBMIT_LESSON_NOTE",
            details: `Submitted lesson plan ${planId} for review`
          }).catch(() => {});
        }
        
        return res.json({ success: true, message: "Lesson plan submitted for approval." });
      } catch (err) {
        return res.json({ success: false, message: "Error submitting lesson plan: " + err.message });
      }
    },

    teacherGetAttendance: async (req, res) => {
      const { className, date } = req.body;
      if (!className || !date) return res.json({ success: false, message: "Class and date required." });
      
      try {
        const attendanceSnap = await db.collection("attendance")
          .where("className", "==", className)
          .where("date", "==", date)
          .get();
          
        const records = [];
        attendanceSnap.forEach(doc => {
          let rec = doc.data();
          rec.id = doc.id;
          records.push(rec);
        });
        
        return res.json({ success: true, data: records });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching attendance: " + err.message });
      }
    },

    teacherSaveAttendance: async (req, res) => {
      if(req.session) { db.collection("audit_logs").add({ timestamp: new Date().toISOString(), userId: req.session.userId, userName: req.session.fullName || "User", action: "MARK_ATTENDANCE", details: `Marked attendance for ${req.body.className || "unknown class"}` }).catch(()=>{}); }
      const records = req.body.records || req.body.data;
      if (!records || !Array.isArray(records)) {
        return res.json({ success: false, message: "Invalid attendance data." });
      }

      const date = req.body.date;
      const className = req.body.className;
      const term = req.body.term || "";
      const session = req.body.session || "";

      if (!date || !className) {
        return res.json({ success: false, message: "Date and class name are required." });
      }

      try {
        // Prevent double entry by checking if another teacher already marked it
        const existingAttendance = await db.collection("attendance")
          .where("className", "==", className)
          .where("date", "==", date)
          .limit(1)
          .get();

        if (!existingAttendance.empty) {
          const existingData = existingAttendance.docs[0].data();
          if (existingData.teacherId && existingData.teacherId !== req.session.userId) {
            let otherTeacherName = "another teacher";
            try {
              const otherTeacherDoc = await db.collection("users").doc(existingData.teacherId).get();
              if (otherTeacherDoc.exists) {
                otherTeacherName = otherTeacherDoc.data().fullName || otherTeacherName;
              }
            } catch (e) {
              // Ignore user fetch errors
            }
            return res.json({ 
              success: false, 
              message: `Attendance for this class on this date has already been marked by ${otherTeacherName}.` 
            });
          }
        }

        const batch = db.batch();
        let count = 0;
        
        for (let record of records) {
          if (!record.studentId) continue;
          
          // Generate deterministic ID so we can blindly update without querying
          const docId = record.studentId + "_" + date.replace(/\//g, "-");
          const ref = db.collection("attendance").doc(docId);
          
          batch.set(ref, {
            studentId: record.studentId,
            className: className,
            date: date,
            status: record.status,
            term: term,
            session: session,
            teacherId: req.session.userId,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          
          count++;
        }
        
        await batch.commit();

        // Send Email Notifications
        try {
          const settingsDoc = await db.collection("settings").doc("global").get();
          const settings = settingsDoc.data();
          if (settings && settings.smtp_email && settings.smtp_password) {
            const nodemailer = require("nodemailer");
            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: { user: settings.smtp_email, pass: settings.smtp_password }
            });
            
            const emailPromises = [];
            
            await Promise.allSettled(records.filter(r => r.studentId && r.status).map(async (record) => {
              const sDoc = await db.collection("students").doc(record.studentId).get();
              if (!sDoc.exists) return;
              const student = sDoc.data();
              if (!student.parentId) return;
              
              const pDoc = await db.collection("users").doc(student.parentId).get();
              if (!pDoc.exists) return;
              const parent = pDoc.data();
              
              if (parent.email) {
                  const studentName = student.fullName || ((student.firstName && student.lastName) ? `${student.firstName} ${student.lastName}` : 'your ward');
                  const mailOptions = {
                    from: `"${settings.school_name || 'School Administration'}" <${settings.smtp_email}>`,
                    to: parent.email,
                    subject: `Attendance Notification for ${studentName}`,
                    text: `Dear ${parent.fullName || 'Parent'},\n\nPlease be informed that your ward, ${studentName}, was marked ${record.status} on ${date} in ${className}.\n\nThank you,\nManagement`
                };
                emailPromises.push(transporter.sendMail(mailOptions));
              }
            }));
            
            // Wait for all emails to be dispatched concurrently to prevent cloud function termination
            await Promise.allSettled(emailPromises);
          }
        } catch(e) {
          console.error("Attendance email error:", e);
        }

        return res.json({ success: true, message: `Saved attendance for ${count} students.` });
      } catch (err) {
        return res.json({ success: false, message: "Error saving attendance: " + err.message });
      }
    },

    teacherGetSubjectAttendance: async (req, res) => {
      const { className, subjectName, date } = req.body;
      if (!className || !subjectName || !date) return res.json({ success: false, message: "Class, subject, and date required." });
      
      try {
        const snap = await db.collection("subject_attendance")
          .where("className", "==", className)
          .where("subjectName", "==", subjectName)
          .where("date", "==", date)
          .get();
          
        const records = [];
        snap.forEach(doc => {
          let rec = doc.data();
          rec.id = doc.id;
          records.push(rec);
        });
        
        return res.json({ success: true, data: records });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching subject attendance: " + err.message });
      }
    },

    teacherSaveSubjectAttendance: async (req, res) => {
      if(req.session) { db.collection("audit_logs").add({ timestamp: new Date().toISOString(), userId: req.session.userId, userName: req.session.fullName || "User", action: "MARK_ATTENDANCE", details: `Marked subject attendance` }).catch(()=>{}); }
      const records = req.body.records || req.body.data;
      if (!records || !Array.isArray(records)) {
        return res.json({ success: false, message: "Invalid attendance data." });
      }

      const { date, className, subjectName, term, session } = req.body;

      if (!date || !className || !subjectName) {
        return res.json({ success: false, message: "Date, class, and subject are required." });
      }

      try {
        const batch = db.batch();
        let count = 0;
        
        for (let record of records) {
          if (!record.studentId) continue;
          
          // Generate deterministic ID
          const docId = record.studentId + "_" + subjectName.replace(/[^a-zA-Z0-9]/g, "") + "_" + date.replace(/\//g, "-");
          const ref = db.collection("subject_attendance").doc(docId);
          
          batch.set(ref, {
            studentId: record.studentId,
            className: className,
            subjectName: subjectName,
            date: date,
            status: record.status,
            term: term || "",
            session: session || "",
            teacherId: req.session.userId,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          
          count++;
        }
        
        await batch.commit();

        return res.json({ success: true, message: `Saved subject attendance for ${count} students.` });
      } catch (err) {
        return res.json({ success: false, message: "Error saving subject attendance: " + err.message });
      }
    },

    teacherGetMontessori: async (req, res) => {
      const { studentId, term, session } = req.body;
      if (!studentId || !term || !session) return res.json({ success: false, message: "Missing parameters." });
      try {
        const snap = await db.collection("montessoriRecords").where("studentId", "==", studentId).where("term", "==", term).where("session", "==", session).get();
        if (snap.empty) return res.json({});
        return res.json(snap.docs[0].data());
      } catch (err) { return res.json({}); }
    },
    
    teacherSaveMontessori: async (req, res) => {
      const { data } = req.body;
      if (!data || !data.studentId || !data.term || !data.session) return res.json({ success: false, message: "Missing data." });
      try {
        const snap = await db.collection("montessoriRecords").where("studentId", "==", data.studentId).where("term", "==", data.term).where("session", "==", data.session).get();
        if (snap.empty) {
          await db.collection("montessoriRecords").add(data);
        } else {
          await db.collection("montessoriRecords").doc(snap.docs[0].id).set(data, { merge: true });
        }
        return res.json({ success: true, message: "Montessori report saved successfully." });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    teacherGetPsychomotor: async (req, res) => {
      const { studentId, term, session } = req.body;
      if (!studentId || !term || !session) return res.json({ success: false, message: "Missing parameters." });
      
      try {
        const snap = await db.collection("psychomotorRecords")
          .where("studentId", "==", studentId)
          .where("term", "==", term)
          .where("session", "==", session)
          .get();
          
        if (snap.empty) return res.json({ success: true, data: null });
        let data = snap.docs[0].data();
        data.id = snap.docs[0].id;
        return res.json({ success: true, data: data });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching psychomotor: " + err.message });
      }
    },

    teacherGetClassSettings: async (req, res) => {
      const { className, term, session } = req.body;
      if (!className || !term || !session) return res.json({ success: false, message: "Missing parameters." });
      try {
        const snap = await db.collection("classSettings")
          .where("className", "==", className)
          .where("term", "==", term)
          .where("session", "==", session)
          .get();
        if (snap.empty) return res.json({ success: true, data: null });
        let data = snap.docs[0].data();
        data.id = snap.docs[0].id;
        return res.json({ success: true, data: data });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching class settings: " + err.message });
      }
    },

    teacherSaveClassSettings: async (req, res) => {
      if(req.session) { db.collection("audit_logs").add({ timestamp: new Date().toISOString(), userId: req.session.userId, userName: req.session.fullName || "User", action: "UPDATE_CLASS_SETTINGS", details: `Updated class settings` }).catch(()=>{}); }
      const data = req.body;
      if (!data || !data.className || !data.term || !data.session) {
        return res.json({ success: false, message: "Missing required data." });
      }
      try {
        const snap = await db.collection("classSettings")
          .where("className", "==", data.className)
          .where("term", "==", data.term)
          .where("session", "==", data.session)
          .get();
        if (!snap.empty) {
          await db.collection("classSettings").doc(snap.docs[0].id).update(data);
          return res.json({ success: true, message: "Class settings updated." });
        } else {
          const newRef = db.collection("classSettings").doc();
          data.id = newRef.id;
          await newRef.set(data);
          return res.json({ success: true, message: "Class settings saved." });
        }
      } catch (err) {
        return res.json({ success: false, message: "Error saving class settings: " + err.message });
      }
    },

    teacherSavePsychomotor: async (req, res) => {
      if(req.session) { db.collection("audit_logs").add({ timestamp: new Date().toISOString(), userId: req.session.userId, userName: req.session.fullName || "User", action: "UPDATE_TRAITS", details: `Updated psychomotor traits` }).catch(()=>{}); }
      const data = req.body.data;
      if (!data || !data.studentId || !data.term || !data.session) {
        return res.json({ success: false, message: "Missing required data." });
      }

      try {
        const snap = await db.collection("psychomotorRecords")
          .where("studentId", "==", data.studentId)
          .where("term", "==", data.term)
          .where("session", "==", data.session)
          .get();

        if (!snap.empty) {
          await db.collection("psychomotorRecords").doc(snap.docs[0].id).update(data);
          return res.json({ success: true, message: "Psychomotor record updated." });
        } else {
          const newRef = db.collection("psychomotorRecords").doc();
          data.id = newRef.id;
          await newRef.set(data);
          return res.json({ success: true, message: "Psychomotor record saved." });
        }
      } catch (err) {
        return res.json({ success: false, message: "Error saving psychomotor: " + err.message });
      }
    },

    teacherGetAffective: async (req, res) => {
      const { studentId, term, session } = req.body;
      if (!studentId || !term || !session) return res.json({ success: false, message: "Missing parameters." });
      
      try {
        const snap = await db.collection("affectiveRecords")
          .where("studentId", "==", studentId)
          .where("term", "==", term)
          .where("session", "==", session)
          .get();
          
        if (snap.empty) return res.json({ success: true, data: null });
        let data = snap.docs[0].data();
        data.id = snap.docs[0].id;
        return res.json({ success: true, data: data });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching affective record: " + err.message });
      }
    },

    teacherSaveAffective: async (req, res) => {
      if(req.session) { db.collection("audit_logs").add({ timestamp: new Date().toISOString(), userId: req.session.userId, userName: req.session.fullName || "User", action: "UPDATE_TRAITS", details: `Updated affective traits` }).catch(()=>{}); }
      const data = req.body.data;
      if (!data || !data.studentId || !data.term || !data.session) {
        return res.json({ success: false, message: "Missing required data." });
      }

      try {
        const snap = await db.collection("affectiveRecords")
          .where("studentId", "==", data.studentId)
          .where("term", "==", data.term)
          .where("session", "==", data.session)
          .get();

        if (!snap.empty) {
          await db.collection("affectiveRecords").doc(snap.docs[0].id).update(data);
          return res.json({ success: true, message: "Affective record updated." });
        } else {
          const newRef = db.collection("affectiveRecords").doc();
          data.id = newRef.id;
          await newRef.set(data);
          return res.json({ success: true, message: "Affective record saved." });
        }
      } catch (err) {
        return res.json({ success: false, message: "Error saving affective record: " + err.message });
      }
    },
    
    teacherGenerateLessonPlanPDF: async (req, res) => {
      try {
        const { planId } = req.body;
        if (!planId) return res.json({ success: false, message: "Plan ID is required." });
        const planDoc = await db.collection("lessonPlans").doc(planId).get();
        if (!planDoc.exists) return res.json({ success: false, message: "Plan not found." });
        const p = planDoc.data() || {};

        // Fetch School Settings
        const settingsDoc = await db.collection("settings").doc("global").get();
        const cfg = settingsDoc.exists ? settingsDoc.data() : {};

        // Resolve Fallback for Class, Subject, and Teacher if missing
        let topic = p.topic || p.title || "Lesson Plan";
        let subjectName = p.subjectName || p.subject || "";
        if (!subjectName && p.subjectId) {
          try {
            const subDoc = await db.collection("subjects").doc(p.subjectId).get();
            if (subDoc.exists) subjectName = subDoc.data().subjectName || subDoc.data().name || "";
          } catch(e) {}
        }

        let className = p.className || "";
        if (!className && p.teacherId) {
          try {
            className = (await getTeacherClass(p.teacherId)) || "";
          } catch(e) {}
        }

        let teacherName = p.teacherName || "";
        if (!teacherName && p.teacherId) {
          try {
            const uDoc = await db.collection("users").doc(p.teacherId).get();
            if (uDoc.exists) teacherName = uDoc.data().fullName || uDoc.data().name || "";
          } catch(e) {}
        }

        const schoolName = cfg.school_name || cfg.schoolName || "VICTORY SPRING NURSERY AND PRIMARY SCHOOL";
        const schoolMotto = cfg.school_motto || cfg.schoolMotto || "VICTORIA AD TENACISSIMOS PERTINET";
        const schoolAddress = cfg.school_address || cfg.schoolAddress || "";
        const schoolPhone = cfg.school_phone || cfg.schoolPhone || "";
        const schoolEmail = cfg.school_email || cfg.schoolEmail || cfg.smtp_email || "";

        // Logos:
        const localLogo = getSchoolLogoBase64();
        // Top-left logo:
        const logoUrl = localLogo || cfg.school_logo_url || "https://victoryspring-681e5.web.app/icon.png";
        // Watermark logo (transparent PNG preferred for clear centered branding):
        const watermarkUrl = localLogo || (cfg.school_logo_url || "https://victoryspring-681e5.web.app/icon.png");

        const statusRaw = (p.status || "Pending").toLowerCase();
        let statusClass = "status-draft";
        let statusLabel = p.status || "Draft";
        if (statusRaw === "approved") {
          statusClass = "status-approved";
          statusLabel = "Approved";
        } else if (statusRaw === "rejected") {
          statusClass = "status-rejected";
          statusLabel = "Rejected";
        } else if (statusRaw === "submitted" || statusRaw === "pending") {
          statusClass = "status-submitted";
          statusLabel = "Pending Approval";
        }

        function escapeHTML(str) {
          if (!str) return "";
          return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        }

        let metaDetails = [];
        if (schoolAddress) metaDetails.push(escapeHTML(schoolAddress));
        if (schoolPhone) metaDetails.push(escapeHTML(schoolPhone));
        if (schoolEmail) metaDetails.push(escapeHTML(schoolEmail));
        const metaLine = metaDetails.join(" &bull; ");

        let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Lesson Plan - ${escapeHTML(topic)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
    
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    body {
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 24px 30px;
      font-size: 13px;
      line-height: 1.55;
      position: relative;
    }
    
    @page {
      size: A4 portrait;
      margin: 12mm 15mm 12mm 15mm;
    }
    
    @media print {
      body {
        padding: 0;
        background: transparent;
      }
      .watermark-container {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        pointer-events: none !important;
        z-index: 0 !important;
      }
      .watermark-img {
        width: 360px !important;
        max-width: 65% !important;
        opacity: 0.08 !important;
      }
      .page-break-avoid {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }

    /* Fixed Watermark - Displayed at exact center on each page */
    .watermark-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 0;
    }
    
    .watermark-img {
      width: 380px;
      max-width: 65%;
      opacity: 0.08;
      pointer-events: none;
      user-select: none;
      object-fit: contain;
    }

    /* Content Wrapper */
    .doc-wrap {
      position: relative;
      z-index: 1;
      max-width: 820px;
      margin: 0 auto;
      background: transparent;
    }

    /* Top Header Section */
    .school-header {
      display: flex;
      align-items: center;
      border-bottom: 2.5px solid #0d2137;
      padding-bottom: 12px;
      margin-bottom: 16px;
      gap: 16px;
    }
    
    .logo-box {
      flex-shrink: 0;
      width: 80px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .logo-img {
      max-width: 80px;
      max-height: 80px;
      object-fit: contain;
    }
    
    .header-content {
      flex: 1;
      text-align: center;
      padding-right: 80px; /* Balance top-left logo optically */
    }
    
    .school-name {
      font-size: 20px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0d2137;
      margin: 0 0 3px 0;
      line-height: 1.2;
    }
    
    .school-motto {
      font-size: 11.5px;
      font-style: italic;
      color: #b45309;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
      text-transform: uppercase;
    }
    
    .school-meta {
      font-size: 10.5px;
      color: #64748b;
      margin-bottom: 6px;
    }
    
    .doc-title-badge {
      display: inline-block;
      background: #0d2137;
      color: #f59e0b;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 2px;
      padding: 3px 20px;
      border-radius: 20px;
      text-transform: uppercase;
    }

    /* Metadata Card */
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 24px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 18px;
      margin-bottom: 18px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .meta-item {
      display: flex;
      align-items: baseline;
      font-size: 12.5px;
    }
    
    .meta-label {
      width: 120px;
      flex-shrink: 0;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.4px;
    }
    
    .meta-val {
      flex: 1;
      font-weight: 600;
      color: #0f172a;
      word-break: break-word;
    }

    /* Content Sections */
    .plan-section {
      margin-bottom: 14px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .section-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #0d2137;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 4px;
      margin: 0 0 6px 0;
      display: flex;
      align-items: center;
    }
    
    .section-title::before {
      content: "";
      display: inline-block;
      width: 4px;
      height: 14px;
      background: #f59e0b;
      margin-right: 8px;
      border-radius: 2px;
    }
    
    .section-body {
      font-size: 12.5px;
      color: #334155;
      line-height: 1.6;
      margin: 0;
      white-space: pre-wrap;
      background: transparent;
    }
    
    .section-body-html {
      font-size: 12.5px;
      color: #334155;
      line-height: 1.6;
      background: transparent;
    }
    
    .section-body-html p {
      margin: 0 0 8px 0;
    }
    
    .section-body-html ul, .section-body-html ol {
      margin: 4px 0 8px 0;
      padding-left: 20px;
    }

    /* Status Badge */
    .status-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 10px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-approved { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .status-rejected { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
    .status-submitted { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .status-draft { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }

    .review-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-left: 4px solid #f59e0b;
      padding: 10px 14px;
      border-radius: 6px;
      color: #92400e;
      font-size: 12.5px;
      line-height: 1.5;
    }

    /* Sign-off / Approval Section */
    .sign-off-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px dashed #cbd5e1;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .sign-col {
      text-align: center;
    }
    
    .sign-line {
      border-bottom: 1px solid #475569;
      height: 35px;
      margin-bottom: 6px;
    }
    
    .sign-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>

  <!-- Watermark of School Logo Centered on Each Page -->
  <div class="watermark-container">
    <img src="${watermarkUrl}" class="watermark-img" alt="Watermark" />
  </div>

  <div class="doc-wrap">
    <!-- Top Header: School Logo at Top Left, Heading of School Name -->
    <div class="school-header">
      <div class="logo-box">
        <img src="${logoUrl}" class="logo-img" alt="School Logo" />
      </div>
      <div class="header-content">
        <h1 class="school-name">${escapeHTML(schoolName)}</h1>
        ${schoolMotto ? `<div class="school-motto">${escapeHTML(schoolMotto)}</div>` : ''}
        ${metaLine ? `<div class="school-meta">${metaLine}</div>` : ''}
        <div class="doc-title-badge">LESSON PLAN</div>
      </div>
    </div>

    <!-- Metadata Grid -->
    <div class="meta-grid">
      <div class="meta-item"><span class="meta-label">Topic:</span><span class="meta-val">${escapeHTML(topic)}</span></div>
      <div class="meta-item"><span class="meta-label">Teacher:</span><span class="meta-val">${escapeHTML(teacherName || 'Teacher')}</span></div>
      
      <div class="meta-item"><span class="meta-label">Subject:</span><span class="meta-val">${escapeHTML(subjectName || 'General')}</span></div>
      <div class="meta-item"><span class="meta-label">Class:</span><span class="meta-val">${escapeHTML(className || 'N/A')}</span></div>
      
      <div class="meta-item"><span class="meta-label">Week:</span><span class="meta-val">${escapeHTML(p.week || 'N/A')}</span></div>
      <div class="meta-item"><span class="meta-label">Term / Session:</span><span class="meta-val">${escapeHTML(p.term || cfg.current_term || '')} ${p.session ? `(${escapeHTML(p.session)})` : ''}</span></div>
      
      <div class="meta-item" style="grid-column: 1 / -1;"><span class="meta-label">Reference Book:</span><span class="meta-val">${escapeHTML(p.referenceBook || 'N/A')}</span></div>
      <div class="meta-item"><span class="meta-label">Status:</span><span class="meta-val"><span class="status-badge ${statusClass}">${escapeHTML(statusLabel)}</span></span></div>
    </div>

    <!-- Plan Sections -->
    ${p.objectives ? `
    <div class="plan-section">
      <h4 class="section-title">Objectives</h4>
      <div class="section-body">${escapeHTML(p.objectives)}</div>
    </div>` : ''}

    ${p.entryBehaviour ? `
    <div class="plan-section">
      <h4 class="section-title">Entry Behaviour</h4>
      <div class="section-body">${escapeHTML(p.entryBehaviour)}</div>
    </div>` : ''}

    ${p.teachingAids ? `
    <div class="plan-section">
      <h4 class="section-title">Teaching Aids</h4>
      <div class="section-body">${escapeHTML(p.teachingAids)}</div>
    </div>` : ''}

    ${p.content ? `
    <div class="plan-section">
      <h4 class="section-title">Lesson Content</h4>
      <div class="section-body-html">${p.content}</div>
    </div>` : ''}

    ${p.presentationSteps ? `
    <div class="plan-section">
      <h4 class="section-title">Presentation Steps</h4>
      <div class="section-body">${escapeHTML(p.presentationSteps)}</div>
    </div>` : ''}

    ${p.evaluation ? `
    <div class="plan-section">
      <h4 class="section-title">Evaluation</h4>
      <div class="section-body">${escapeHTML(p.evaluation)}</div>
    </div>` : ''}

    ${p.assignment ? `
    <div class="plan-section">
      <h4 class="section-title">Assignment</h4>
      <div class="section-body">${escapeHTML(p.assignment)}</div>
    </div>` : ''}

    ${p.reviewNote ? `
    <div class="plan-section">
      <h4 class="section-title">Supervisor / Review Note</h4>
      <div class="review-box">${escapeHTML(p.reviewNote)}</div>
    </div>` : ''}

    <!-- Sign-off Block -->
    <div class="sign-off-grid">
      <div class="sign-col">
        <div class="sign-line"></div>
        <div class="sign-label">Class Teacher's Signature &amp; Date</div>
      </div>
      <div class="sign-col">
        <div class="sign-line"></div>
        <div class="sign-label">Head Teacher / Principal's Signature &amp; Date</div>
      </div>
    </div>
  </div>

</body>
</html>`;
        
        const dataUri = "data:text/html;charset=utf-8," + encodeURIComponent(html);
        return res.json({ success: true, previewUrl: dataUri, downloadUrl: dataUri });
      } catch (err) {
        return res.json({ success: false, message: "Error generating PDF: " + err.message });
      }
    },

    // ================================================================
    // ASSIGNMENTS
    // ================================================================

    teacherSaveAssignment: async (req, res) => {
      if(req.session) { db.collection("audit_logs").add({ timestamp: new Date().toISOString(), userId: req.session.userId, userName: req.session.fullName || "User", action: "CREATE_CONTENT", details: `Saved assignment` }).catch(()=>{}); }
      const data = req.body.data;
      if (!data || !data.title) return res.json({ success: false, message: "Assignment title required." });
      try {
        const settings = await db.collection("settings").doc("global").get();
        const s = settings.exists ? settings.data() : {};
        const payload = {
          ...data,
          teacherId: req.session.userId,
          teacherName: req.session.fullName || "",
          term: data.term || s.current_term || "",
          session: data.session || s.current_session || "",
          createdAt: new Date().toISOString()
        };
        if (data.id) {
          await db.collection("assignments").doc(data.id).update(payload);
          return res.json({ success: true, message: "Assignment updated." });
        } else {
          const ref = db.collection("assignments").doc();
          await ref.set(payload);
          return res.json({ success: true, message: "Assignment created.", id: ref.id });
        }
      } catch (err) {
        return res.json({ success: false, message: "Error saving assignment: " + err.message });
      }
    },

    teacherGetMyAssignments: async (req, res) => {
      try {
        const snap = await db.collection("assignments")
          .where("teacherId", "==", req.session.userId).get();
        const results = [];
        snap.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
        results.sort((a, b) => (b.createdAt || "") > (a.createdAt || "") ? 1 : -1);
        return res.json({ success: true, data: results });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    teacherDeleteAssignment: async (req, res) => {
      const { assignmentId } = req.body;
      if (!assignmentId) return res.json({ success: false, message: "Assignment ID required." });
      try {
        await db.collection("assignments").doc(assignmentId).delete();
        return res.json({ success: true, message: "Assignment deleted." });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    // ================================================================
    // LESSON NOTES
    // ================================================================

    teacherSaveNote: async (req, res) => {
      if(req.session) { db.collection("audit_logs").add({ timestamp: new Date().toISOString(), userId: req.session.userId, userName: req.session.fullName || "User", action: "CREATE_CONTENT", details: `Saved class note` }).catch(()=>{}); }
      const data = req.body.data;
      if (!data || !data.title) return res.json({ success: false, message: "Note title required." });
      try {
        const settings = await db.collection("settings").doc("global").get();
        const s = settings.exists ? settings.data() : {};
        const payload = {
          title: data.title,
          subjectName: data.subjectName || "",
          className: data.className || "All",
          fileName: data.fileName || "",
          mimeType: data.mimeType || data.fileMime || "application/pdf",
          fileData: data.fileData || "",
          teacherId: req.session.userId,
          teacherName: req.session.fullName || "",
          term: data.term || s.current_term || "",
          session: data.session || s.current_session || "",
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };
        const ref = db.collection("lesson_notes").doc();
        await ref.set(payload);
        return res.json({ success: true, message: "Note uploaded. It will auto-expire in 7 days.", id: ref.id });
      } catch (err) {
        return res.json({ success: false, message: "Error saving note: " + err.message });
      }
    },

    teacherGetMyNotes: async (req, res) => {
      try {
        const snap = await db.collection("lesson_notes")
          .where("teacherId", "==", req.session.userId).get();
        const now = Date.now();
        const results = [];
        const deletePromises = [];
        snap.forEach(doc => {
          const d = doc.data();
          const created = d.createdAt ? new Date(d.createdAt).getTime() : 0;
          const expired = now - created > 7 * 24 * 60 * 60 * 1000;
          if (expired) {
            deletePromises.push(doc.ref.delete());
          } else {
            const { fileData, ...meta } = d; // strip file data from list
            results.push({ id: doc.id, ...meta, expired });
          }
        });
        await Promise.all(deletePromises);
        results.sort((a, b) => (b.createdAt || "") > (a.createdAt || "") ? 1 : -1);
        return res.json({ success: true, data: results });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    teacherDeleteNote: async (req, res) => {
      const { noteId } = req.body;
      if (!noteId) return res.json({ success: false, message: "Note ID required." });
      try {
        await db.collection("lesson_notes").doc(noteId).delete();
        return res.json({ success: true, message: "Note deleted." });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    // ================================================================
    // CBT QUIZZES
    // ================================================================

    teacherSaveQuiz: async (req, res) => {
      const data = req.body.data;
      if (!data || !data.title) return res.json({ success: false, message: "Quiz title required." });
      try {
        const settings = await db.collection("settings").doc("global").get();
        const s = settings.exists ? settings.data() : {};
        const payload = {
          title: data.title,
          subjectName: data.subjectName || "",
          className: data.className || "All",
          durationMinutes: parseInt(data.durationMinutes) || 30,
          obtainableScore: parseFloat(data.obtainableScore) || null,
          shuffleQuestions: !!data.shuffleQuestions,
          shuffleOptions: !!data.shuffleOptions,
          teacherId: req.session.userId,
          teacherName: req.session.fullName || "",
          term: data.term || s.current_term || "",
          session: data.session || s.current_session || "",
          isPublished: data.isPublished || false,
          availableFrom: data.availableFrom || null,
          availableTo: data.availableTo || null,
          createdAt: new Date().toISOString()
        };
        if (data.id) {
          await db.collection("cbt_quizzes").doc(data.id).update({ ...payload, isPublished: !!data.isPublished });
          return res.json({ success: true, message: "Quiz updated.", id: data.id });
        } else {
          const ref = db.collection("cbt_quizzes").doc();
          await ref.set(payload);
          return res.json({ success: true, message: "Quiz created.", id: ref.id });
        }
      } catch (err) {
        return res.json({ success: false, message: "Error saving quiz: " + err.message });
      }
    },

    teacherGetMyQuizzes: async (req, res) => {
      try {
        const snap = await db.collection("cbt_quizzes")
          .where("teacherId", "==", req.session.userId).get();
        const results = [];
        for (const doc of snap.docs) {
          const qSnap = await db.collection("cbt_questions").where("quizId", "==", doc.id).get();
          const attSnap = await db.collection("cbt_attempts").where("quizId", "==", doc.id).where("status", "==", "completed").get();
          results.push({ id: doc.id, ...doc.data(), questionCount: qSnap.size, attemptCount: attSnap.size });
        }
        results.sort((a, b) => (b.createdAt || "") > (a.createdAt || "") ? 1 : -1);
        return res.json({ success: true, data: results });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    teacherSaveQuestions: async (req, res) => {
      const { quizId, questions } = req.body;
      if (!quizId || !questions || !Array.isArray(questions)) {
        return res.json({ success: false, message: "Quiz ID and questions array required." });
      }
      try {
        // Delete existing questions for this quiz first
        const existSnap = await db.collection("cbt_questions").where("quizId", "==", quizId).get();
        const batch = db.batch();
        existSnap.docs.forEach(doc => batch.delete(doc.ref));

        const answerKey = {};
        questions.forEach(q => {
          if (!q.question || !q.correctAnswer) return;
          const ref = db.collection("cbt_questions").doc();
          batch.set(ref, {
            quizId,
            question: q.question,
            imageUrl: q.imageUrl || "",
            optionA: q.optionA || "",
            optionB: q.optionB || "",
            optionC: q.optionC || "",
            optionD: q.optionD || "",
            correctAnswer: q.correctAnswer.toUpperCase(),
            createdAt: new Date().toISOString()
          });
          answerKey[ref.id] = q.correctAnswer.toUpperCase();
        });

        batch.update(db.collection("cbt_quizzes").doc(quizId), { answerKey });
        await batch.commit();
        return res.json({ success: true, message: `${questions.length} question(s) saved.` });
      } catch (err) {
        return res.json({ success: false, message: "Error saving questions: " + err.message });
      }
    },

    teacherGetQuizQuestions: async (req, res) => {
      const { quizId } = req.body;
      if (!quizId) return res.json({ success: false, message: "Quiz ID required." });
      try {
        const snap = await db.collection("cbt_questions").where("quizId", "==", quizId).get();
        const results = [];
        snap.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
        return res.json({ success: true, data: results });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    teacherDeleteQuiz: async (req, res) => {
      const { quizId } = req.body;
      if (!quizId) return res.json({ success: false, message: "Quiz ID required." });
      try {
        const batch = db.batch();
        batch.delete(db.collection("cbt_quizzes").doc(quizId));
        const qSnap = await db.collection("cbt_questions").where("quizId", "==", quizId).get();
        qSnap.docs.forEach(doc => batch.delete(doc.ref));
        const aSnap = await db.collection("cbt_attempts").where("quizId", "==", quizId).get();
        aSnap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        return res.json({ success: true, message: "Quiz and all related data deleted." });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    teacherGetQuizResults: async (req, res) => {
      const { quizId } = req.body;
      if (!quizId) return res.json({ success: false, message: "Quiz ID required." });
      try {
        const quizSnap = await db.collection("cbt_quizzes").doc(quizId).get();
        const obtainableScore = quizSnap.exists ? (quizSnap.data().obtainableScore || null) : null;

        const snap = await db.collection("cbt_attempts")
          .where("quizId", "==", quizId)
          .where("status", "==", "completed").get();
        const results = [];
        snap.forEach(doc => {
          const d = doc.data();
          results.push({ 
            id: doc.id, 
            studentId: d.studentId,
            studentName: d.studentName, 
            className: d.className, 
            score: d.score, 
            total: d.total, 
            percentage: d.percentage, 
            submittedAt: d.submittedAt,
            obtainableScore: obtainableScore
          });
        });
        results.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
        return res.json({ success: true, data: results });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    teacherPublishQuiz: async (req, res) => {
      if(req.session) { db.collection("audit_logs").add({ timestamp: new Date().toISOString(), userId: req.session.userId, userName: req.session.fullName || "User", action: "PUBLISH_QUIZ", details: `Published quiz` }).catch(()=>{}); }
      const { quizId, publish } = req.body;
      if (!quizId) return res.json({ success: false, message: "Quiz ID required." });
      try {
        await db.collection("cbt_quizzes").doc(quizId).update({ isPublished: !!publish });
        return res.json({ success: true, message: publish ? "Quiz published. Students can now access it." : "Quiz unpublished." });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    }
  };
};
