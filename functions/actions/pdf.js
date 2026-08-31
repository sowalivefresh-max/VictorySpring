module.exports = {
  getReportCSS: function() {
    let html = '<style>';
    html += 'body{font-family: Arial, Helvetica, sans-serif; margin:0; padding:0; color:#000; font-size:10px;}';
    html += '.wrap{max-width:800px; margin:0 auto; padding:15px; box-sizing:border-box; border: 4px double #000;}';
    html += '.hdr{display:flex; align-items:center; margin-bottom:10px;}';
    html += '.logo{width:80px; height:80px; object-fit:contain; margin-right:15px;}';
    html += '.logo-ph{width:80px; height:80px; background:#0d1b2a; display:flex; align-items:center; justify-content:center; color:#f0a500; font-weight:bold; font-size:14px; margin-right:15px;}';
    html += '.school-info{flex:1; text-align:center;}';
    html += '.school-name{font-size:24px; font-weight:bold; text-transform:uppercase; color:#000; font-family:"Times New Roman", Times, serif;}';
    html += '.school-motto{font-size:12px; font-style:italic; margin:2px 0;}';
    html += '.rpt-title{font-size:14px; font-weight:bold; text-transform:uppercase; margin-top:8px; text-decoration: underline;}';
    
    html += '.bio-box{display:flex; border: 2px solid #000; margin-bottom:10px; border-radius: 4px; overflow:hidden;}';
    html += '.bio-data{flex:1; padding:0;}';
    html += '.bio-row{display:flex; border-bottom:1px solid #000;}';
    html += '.bio-row:last-child{border-bottom:none;}';
    html += '.bio-cell{flex:1; display:flex; border-right:1px solid #000; padding:4px;}';
    html += '.bio-cell:last-child{border-right:none;}';
    html += '.bio-label{font-weight:bold; margin-right:5px; text-transform:uppercase;}';
    html += '.passport{width:90px; border-left:2px solid #000; display:flex; align-items:center; justify-content:center; background:#eee;}';
    
    html += 'table{width:100%; border-collapse:collapse; margin-bottom:10px;}';
    html += 'th, td{border:1px solid #000; padding:4px; text-align:center;}';
    html += 'th{background:#f0f0f0; font-weight:bold; text-transform:uppercase; font-size:10px;}';
    html += '.text-left{text-align:left; padding-left:8px;}';
    
    html += '.summary-row{font-weight:bold; background:#f9f9f9;}';
    
    html += '.cols-3{display:flex; gap:10px;}';
    html += '.col{flex:1;}';
    
    html += '.trait-table{width:100%; border-collapse:collapse; margin-bottom:8px; font-size:9px;}';
    html += '.trait-table th, .trait-table td{border:1px solid #000; padding:2px 4px; text-align:left;}';
    html += '.trait-table th{background:#f0f0f0; text-align:center;}';
    html += '.trait-table .center{text-align:center;}';
    
    html += '.comment-box{border:1px solid #000; padding:5px; margin-bottom:8px;}';
    html += '.comment-title{font-weight:bold; text-transform:uppercase; margin-bottom:4px; font-size:10px; border-bottom:1px solid #000; padding-bottom:2px;}';
    html += '.comment-text{font-style:italic; min-height:20px;}';
    
    html += '.legend-table{width:100%; font-size:8px; margin-bottom:8px;}';
    html += '.legend-table td{padding:1px; border:none; text-align:left;}';
    
    html += '.sig-block{margin-top:10px; display:flex; align-items:flex-end; gap:5px;}';
    html += '.sig-line{flex:1; border-bottom:1px solid #000; height:15px;}';
    
    html += '.page-break { page-break-after: always; }';
    html += '</style>';
    return html;
  },

  generateStudentReportHTML: function(report, cfg) {
    const s = report.student || {};
    const scores = report.scores || [];
    const summary = report.summary || {};
    const att = report.attendance || { present: 0, absent: 0, late: 0, total: 0, percentage: 0 };
    const psy = report.psychomotor || {};
    const term = report.term || '';
    const session = report.session || '';

    let html = '<!DOCTYPE html><html><head><meta charset="utf-8">';
    html += this.getReportCSS();
    html += '</head><body><div class="wrap">';

    // Header
    html += '<div class="hdr">';
    html += '<div class="logo-ph">Logo</div>'; // Client handles logo
    html += '<div class="school-info">';
    html += '<div class="school-name">' + (cfg.schoolName || "VICTORY SPRING SCHOOL") + '</div>';
    if (cfg.schoolMotto) html += '<div class="school-motto">' + cfg.schoolMotto + '</div>';
    html += '<div style="font-size:10px; margin-top:2px;">' + (cfg.schoolAddress || 'School Address') + '</div>';
    html += '<div class="rpt-title">STUDENT REPORT SHEET</div>';
    html += '</div>';
    html += '</div>';

    // Biodata Grid
    let photoUrl = s.photoUrl || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(s.fullName || 'S') + '&background=f0a500&color=fff&size=300');
    
    html += '<div class="bio-box">';
    html += '<div class="bio-data">';
    html += '<div class="bio-row">';
    html += '<div class="bio-cell"><span class="bio-label">NAME:</span> ' + (s.fullName || '') + '</div>';
    html += '<div class="bio-cell"><span class="bio-label">ADMISSION NO:</span> ' + (s.admissionNumber || '') + '</div>';
    html += '<div class="bio-cell"><span class="bio-label">GENDER:</span> ' + (s.gender || '') + '</div>';
    html += '</div>';
    html += '<div class="bio-row">';
    html += '<div class="bio-cell"><span class="bio-label">CLASS:</span> ' + (s.className || '') + '</div>';
    html += '<div class="bio-cell"><span class="bio-label">TERM:</span> ' + term + '</div>';
    html += '<div class="bio-cell"><span class="bio-label">YEAR:</span> ' + session + '</div>';
    html += '</div>';
    html += '<div class="bio-row">';
    html += '<div class="bio-cell"><span class="bio-label">D.O.B:</span> ' + (s.dob || '') + '</div>';
    html += '<div class="bio-cell"><span class="bio-label">CLASS AGE AVERAGE:</span> </div>';
    html += '<div class="bio-cell"><span class="bio-label">NO. IN CLASS:</span> </div>';
    html += '</div>';
    html += '<div class="bio-row">';
    html += '<div class="bio-cell"><span class="bio-label">TIMES SCHOOL OPENED:</span> ' + (att.total || '') + '</div>';
    html += '<div class="bio-cell" style="flex:1.5;"><span class="bio-label">ATTENDANCE:</span> <span style="font-weight:bold;">' + (att.percentage || 0) + '%</span> <span style="font-size:9px; color:#555; margin-left:10px;">[Pre: ' + (att.present || 0) + ' | Abs: ' + (att.absent || 0) + ' | Late: ' + (att.late || 0) + ']</span></div>';
    html += '<div class="bio-cell"><span class="bio-label">NEW TERM STARTS:</span> </div>';
    html += '</div>';
    html += '</div>';
    html += '<div class="passport"><img src="' + photoUrl + '" style="width:100%; height:100%; object-fit:cover;"></div>';
    html += '</div>';

    let isHalfTerm = report.reportType && report.reportType.toLowerCase().includes('half');

    // Scores Table (Core Subjects)
    html += '<table>';
    html += '<tr><th>SUBJECTS</th>';
    if (isHalfTerm) {
      html += '<th>CA1</th><th>CA2</th>';
    } else {
      html += '<th>CA (40%)</th><th>EXAM (60%)</th><th>TOTAL (100%)</th><th>GRADE</th>';
    }
    html += '</tr>';

    let totalMarks = 0;
    for (let i = 0; i < scores.length; i++) {
      let sc = scores[i];
      let tTotal = Number(sc.total || sc.termTotal || 0);
      totalMarks += tTotal;
      html += '<tr><td class="text-left">' + (sc.subjectName || '') + '</td>';
      
      if (isHalfTerm) {
        let ca1 = sc.ca1 !== undefined ? sc.ca1 : (sc.CA1 || '');
        let ca2 = sc.ca2 !== undefined ? sc.ca2 : (sc.CA2 || '');
        html += '<td>' + ca1 + '</td><td>' + ca2 + '</td>';
      } else {
        // Full term expects CA to be sum of CA1, CA2, CA3
        let ca1 = Number(sc.ca1 || sc.CA1 || 0);
        let ca2 = Number(sc.ca2 || sc.CA2 || 0);
        let ca3 = Number(sc.ca3 || sc.CA3 || 0);
        let sumCA = ca1 + ca2 + ca3;
        let exam = sc.exam !== undefined ? sc.exam : (sc.EXAM || '');
        let g = sc.termGrade || sc.grade || '';
        html += '<td>' + sumCA + '</td><td>' + exam + '</td><td><strong>' + tTotal + '</strong></td><td>' + g + '</td>';
      }
      html += '</tr>';
    }

    html += '<tr class="summary-row"><td class="text-left">CORE SUBJECTS OFFERED</td><td colspan="' + (isHalfTerm ? 2 : 4) + '" style="text-align:left; padding-left:10px;">' + scores.length + '</td></tr>';
    if (!isHalfTerm) {
      html += '<tr class="summary-row"><td class="text-left">TOTAL MARKS OBTAINED</td><td colspan="4" style="text-align:left; padding-left:10px;">' + totalMarks + '</td></tr>';
      html += '<tr class="summary-row"><td class="text-left">PUPIL AVERAGE OF CORE SUBJECTS</td><td colspan="4" style="text-align:left; padding-left:10px;">' + (summary.average || 0) + '%</td></tr>';
    }
    html += '</table>';

    // 3 Columns Layout
    html += '<div class="cols-3">';
    
    // Column 1
    html += '<div class="col">';
    html += '<table class="trait-table">';
    html += '<tr><th colspan="2">HOME PERFORMANCE INDICES</th></tr>';
    ['Punctuality', 'Neatness', 'PTC attendance', 'Quality of homework submitted', 'Prompt homework submission'].forEach((t, i) => {
      let keys = ['hp_punctuality', 'hp_neatness', 'hp_ptc', 'hp_hw_quality', 'hp_hw_prompt'];
      html += '<tr><td>' + t + '</td><td width="30" class="center">' + (psy[keys[i]] || '') + '</td></tr>';
    });
    html += '</table>';
    
    html += '<table class="trait-table">';
    html += '<tr><th colspan="2">CONDUCTS & WORK HABITS</th></tr>';
    let conducts = ['Polite', 'Independent & Organized', 'Relates appropriately with adults', 'Maintains appropriate behaviour without prompting', 'Exhibits eagerness & curiousity as a learner', 'Participates actively in class', 'Collaborates with other children for learning', 'Perseveres at a challenging task', 'Daily work reflects best effort', 'Leadership skills', 'Public presentation skills'];
    let cKeys = ['cd_polite', 'cd_independent', 'cd_adults', 'cd_behaviour', 'cd_curious', 'cd_active', 'cd_collaborates', 'cd_perseveres', 'cd_effort', 'cd_leadership', 'cd_presentation'];
    conducts.forEach((t, i) => {
      html += '<tr><td>' + t + '</td><td width="30" class="center">' + (psy[cKeys[i]] || '') + '</td></tr>';
    });
    html += '</table>';
    html += '</div>'; // End col 1

    // Column 2
    html += '<div class="col">';
    html += '<table class="trait-table">';
    html += '<tr><th colspan="2">OTHER SUBJECTS</th></tr>';
    let others = ['Music', 'Physical Education', 'Swimming', 'Library', 'Handwriting', 'Chess', 'Diction', 'Project'];
    let oKeys = ['os_music', 'os_pe', 'os_swimming', 'os_library', 'os_handwriting', 'os_chess', 'os_diction', 'os_project'];
    others.forEach((t, i) => {
      html += '<tr><td>' + t + '</td><td width="30" class="center">' + (psy[oKeys[i]] || '') + '</td></tr>';
    });
    html += '</table>';
    
    html += '<table class="trait-table">';
    html += '<tr><th colspan="2">ENRICHMENT ACTIVITIES</th></tr>';
    let enrich = ['Computer', 'French', 'Arts & Craft', 'Taekwando', 'Ballet', 'Leadership', 'Robotics', 'Music', 'Table Tennis / Football / Basketball', 'Reading Club', 'Chess/Scrabble', 'Etiquette / Red Cross'];
    let eKeys = ['en_computer', 'en_french', 'en_arts', 'en_taekwando', 'en_ballet', 'en_leadership', 'en_robotics', 'en_music', 'en_sports', 'en_reading', 'en_chess', 'en_etiquette'];
    enrich.forEach((t, i) => {
      html += '<tr><td>' + t + '</td><td width="30" class="center">' + (psy[eKeys[i]] || '') + '</td></tr>';
    });
    html += '</table>';
    html += '</div>'; // End col 2

    // Column 3
    html += '<div class="col">';
    html += '<div class="comment-box"><div class="comment-title">TEACHER\'S COMMENT:</div><div class="comment-text">' + (report.classTeacherComment || '') + '</div></div>';
    
    let ctName = cfg.class_teacher_name || report.classTeacherName || '';
    let ctSig = cfg.class_teacher_signature ? '<img src="' + cfg.class_teacher_signature + '" style="max-height:20px; object-fit:contain;">' : '';
    html += '<div class="sig-block" style="margin-top: 15px;"><div style="font-weight:bold; font-size:9px;">TEACHER\'S NAME:</div><div class="sig-line" style="display:flex; justify-content:center; font-style:italic;">' + ctName + ' ' + ctSig + '</div></div>';
    
    html += '<table class="trait-table" style="margin-top:15px; margin-bottom:15px;">';
    html += '<tr><th colspan="4">GRADES</th></tr>';
    html += '<tr><td class="center">A</td><td>EXCELLENT</td><td class="center">90-100%</td><td>NA: NEEDS ATTENTION</td></tr>';
    html += '<tr><td class="center">B</td><td>VERY GOOD</td><td class="center">80-89%</td><td>D: DEVELOPING</td></tr>';
    html += '<tr><td class="center">C</td><td>GOOD</td><td class="center">70-79%</td><td>SD: STEADILY DEVELOPING</td></tr>';
    html += '<tr><td class="center">D</td><td>FAIR</td><td class="center">60-69%</td><td>M: MASTERED</td></tr>';
    html += '<tr><td class="center">E</td><td>POOR</td><td class="center">50-59%</td><td></td></tr>';
    html += '<tr><td class="center">F</td><td>FAIL</td><td class="center">0-49%</td><td></td></tr>';
    html += '</table>';
    
    html += '<div class="comment-box"><div class="comment-title">HEAD TEACHER\'S COMMENT:</div><div class="comment-text">' + (report.principalComment || report.headTeacherComment || '') + '</div></div>';
    
    let prinSig = (cfg.principal_signature || cfg.head_teacher_signature) ? '<img src="' + (cfg.principal_signature || cfg.head_teacher_signature) + '" style="max-height:20px; object-fit:contain;">' : '';
    html += '<div class="sig-block" style="margin-top: 15px;"><div style="font-weight:bold; font-size:9px;">SIGNATURE:</div><div class="sig-line" style="display:flex; justify-content:center;">' + prinSig + '</div></div>';
    
    html += '</div>'; // End col 3
    html += '</div>'; // End cols-3

    html += '</div></body></html>';
    return html;
  },

  generateStudentIdCardHTML: function(student, cfg) {
    let schoolName = cfg.school_name || 'MY SCHOOL CLOUD';
    let motto = cfg.school_motto || 'In Love, Serve One Another';
    let termSess = (student.session || '2025/2026');
    let sectionName = 'Primary School';
    
    let photoUrl = student.photoUrl || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(student.fullName || 'S') + '&background=f0a500&color=fff&size=300');
    let logoUrl = cfg.school_logo_url || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(schoolName) + '&background=0d1b2a&color=fff');

    // Build repeating watermark text for the front
    let wmText = '';
    for(let i = 0; i < 30; i++) { wmText += '<div class="watermark-text">' + schoolName + '</div>'; }

    let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ID Card</title><style>';
    html += '@import url("https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap");';
    html += 'body { font-family: "Outfit", sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #e2e8f0; gap: 30px; padding: 20px; }';
    html += '.card { width: 520px; height: 320px; background: #ffffff; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.05); position: relative; overflow: hidden; display: flex; flex-direction: row; box-sizing: border-box; }';
    html += '.card::before { content: ""; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle at 75% 25%, rgba(240, 165, 0, 0.08) 0%, transparent 40%), radial-gradient(circle at 10% 90%, rgba(13, 27, 42, 0.04) 0%, transparent 40%); z-index: 0; pointer-events: none; }';
    
    // Front Watermarks
    html += '.watermark-front { position: absolute; top: 0; left: -100px; width: 800px; height: 400px; display: flex; flex-wrap: wrap; transform: rotate(-25deg); opacity: 0.04; pointer-events: none; z-index: 1; align-content: center; justify-content: center; }';
    html += '.watermark-text { font-size: 18px; font-weight: 800; color: #0f172a; margin: 10px 20px; white-space: nowrap; text-transform: uppercase; letter-spacing: 2px; }';

    
    // LEFT SIDE - PHOTO PROFILE
    html += '.photo-pane { width: 38%; height: 100%; position: relative; z-index: 2; padding: 25px 20px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; border-right: 1px solid rgba(0,0,0,0.05); }';
    html += '.student-photo { width: 135px; height: 155px; border-radius: 14px; object-fit: cover; box-shadow: 0 12px 24px rgba(0,0,0,0.12); border: 4px solid #ffffff; background: #e2e8f0; }';
    html += '.badge { margin-top: 20px; background: rgba(240, 165, 0, 0.15); color: #c27d00; font-size: 11px; font-weight: 800; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px; text-align: center; width: max-content; }';

    // RIGHT SIDE - CONTENT
    html += '.content-pane { width: 62%; height: 100%; position: relative; z-index: 2; padding: 25px 30px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }';
    html += '.header { display: flex; align-items: center; gap: 12px; }';
    html += '.logo-img { width: 45px; height: 45px; border-radius: 10px; object-fit: contain; background: #fff; padding: 2px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }';
    html += '.school-info { display: flex; flex-direction: column; justify-content: center; }';
    html += '.school-name { font-size: 15px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; line-height: 1.2; }';
    html += '.school-motto { font-size: 10px; color: #64748b; font-weight: 500; font-style: italic; margin-top: 3px; }';
    
    html += '.identity-section { margin-top: auto; margin-bottom: auto; }';
    html += '.card-title { font-size: 9px; font-weight: 800; color: #f0a500; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 5px; }';
    html += '.student-name { font-size: 24px; font-weight: 800; color: #0f172a; text-transform: uppercase; line-height: 1.1; margin-bottom: 15px; letter-spacing: -0.5px; }';
    
    html += '.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 15px; }';
    html += '.info-item { display: flex; flex-direction: column; gap: 3px; }';
    html += '.info-label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }';
    html += '.info-value { font-size: 13px; font-weight: 600; color: #334155; }';
    
    html += '.footer { display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px solid rgba(0,0,0,0.06); margin-top: auto; }';
    html += '.footer-text { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }';
    html += '.accent-line { position: absolute; left: 0; bottom: 0; width: 100%; height: 5px; background: linear-gradient(90deg, #f0a500, #ffc947); }';
    
    // BACK SIDE
    html += '.card.back { flex-direction: column; padding: 30px; justify-content: center; }';
    html += '.back-header { text-align: center; font-size: 16px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 1.5px; z-index: 2; margin-bottom: 25px; }';
    html += '.terms-title { font-size: 11px; font-weight: 800; color: #f0a500; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; z-index: 2; }';
    html += '.terms-list { margin: 0; padding-left: 15px; z-index: 2; font-size: 12px; color: #475569; font-weight: 500; line-height: 1.6; }';
    html += '.terms-list li { margin-bottom: 6px; }';
    html += '.terms-list li::marker { color: #f0a500; font-size: 14px; }';
    html += '.barcode-wrapper { text-align: center; margin-top: auto; z-index: 2; }';
    html += '.barcode { font-size: 16px; font-weight: 800; color: #0f172a; letter-spacing: 3px; font-family: monospace; }';
    html += '.barcode-bars { margin: 8px auto 0; width: 220px; height: 30px; background-image: repeating-linear-gradient(90deg, #0f172a, #0f172a 2px, transparent 2px, transparent 5px, #0f172a 5px, #0f172a 9px, transparent 9px, transparent 12px); opacity: 0.85; }';
    html += '.watermark-back { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.04; z-index: 1; width: 240px; height: 240px; object-fit: contain; }';
    
    html += '</style></head><body>';
    
    // ====== FRONT CARD ======
    html += '<div class="card front">';
    html += '<div class="watermark-front">' + wmText + '</div>';
    
    html += '<div class="photo-pane">';
    html += '<img src="' + photoUrl + '" class="student-photo" alt="Photo">';
    html += '<div class="badge">' + sectionName + '</div>';
    html += '</div>'; // end photo-pane
    
    html += '<div class="content-pane">';
    
    html += '<div class="header">';
    html += '<img src="' + logoUrl + '" class="logo-img" alt="Logo">';
    html += '<div class="school-info">';
    html += '<div class="school-name">' + schoolName + '</div>';
    html += '<div class="school-motto">' + motto + '</div>';
    html += '</div>'; // end school-info
    html += '</div>'; // end header
    
    html += '<div class="identity-section">';
    html += '<div class="card-title">Student Identity Card</div>';
    html += '<div class="student-name">' + (student.fullName || 'N/A') + '</div>';
    
    html += '<div class="info-grid" style="grid-template-columns: 1fr; gap: 8px;">';
    html += '<div class="info-item"><span class="info-label">Admission No</span><span class="info-value">' + (student.admissionNumber || 'N/A') + '</span></div>';
    html += '<div class="info-item"><span class="info-label">Class</span><span class="info-value">' + (student.className || 'N/A') + '</span></div>';
    html += '<div class="info-item"><span class="info-label">Gender</span><span class="info-value">' + (student.gender || 'N/A') + '</span></div>';
    html += '</div>'; // end info-grid
    html += '</div>'; // end identity-section
    
    html += '<div class="footer">';
    html += '<div class="footer-text">Valid: ' + termSess + '</div>';
    html += '<div class="footer-text">Academic Session</div>';
    html += '</div>'; // end footer
    
    html += '<div class="accent-line"></div>';
    html += '</div>'; // end content-pane
    html += '</div>'; // end front card

    // ====== BACK CARD ======
    html += '<div class="card back">';
    html += '<img src="' + logoUrl + '" class="watermark-back" alt="Watermark">';
    html += '<div class="back-header">' + schoolName + '</div>';
    
    html += '<div class="terms-title">Terms & Conditions</div>';
    html += '<ul class="terms-list">';
    html += '<li>This card must be worn at all times within the school premises.</li>';
    html += '<li>This card is non-transferable and must not be defaced.</li>';
    html += '<li>Loss of card must be reported to the school office immediately.</li>';
    html += '<li>If found, please return to the school office.</li>';
    html += '</ul>';
    
    html += '<div class="barcode-wrapper">';
    html += '<div class="barcode">' + (student.admissionNumber || 'N/A') + '</div>';
    html += '<div class="barcode-bars"></div>';
    html += '</div>'; // end barcode-wrapper
    
    html += '<div class="accent-line"></div>';
    html += '</div>'; // end back card

    html += '</body></html>';
    
    return html;
  }
};
