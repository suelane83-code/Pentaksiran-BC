import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import { 
  UserCircle, Lock, LogOut, Plus, Trash2, Edit3, Save, X, Search, ChevronRight, 
  BookOpen, Users, BarChart2, CheckCircle, AlertCircle, Leaf, Sprout, ClipboardList, Download, TrendingUp, Info, KeyRound, UserPlus, Database
} from 'lucide-react';

// ==========================================
// FIREBASE 配置
// ==========================================
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCBTuwRcUXt3OuqrpIVD8Kr6Mk7YvlnizE",
  authDomain: "bc-pentaksiran.firebaseapp.com",
  projectId: "bc-pentaksiran",
  storageBucket: "bc-pentaksiran.firebasestorage.app",
  messagingSenderId: "738832841028",
  appId: "1:738832841028:web:e7ad08371899cc05257f11",
  measurementId: "G-VLVL1M364V"
};

const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'my-mock-exam-system';

// ==========================================
// 常量与初始数据
// ==========================================
const SECURITY_QUESTION = "你最喜欢的食物是什么？";
const SECURITY_ANSWER = "椰浆饭"; 
const ADMIN_PASSWORD = "6027";

const GRADE_RANGES = [
  { min: 82, max: 100, grade: 'A', desc: '卓越', status: '及格' },
  { min: 66, max: 81, grade: 'B', desc: '优良', status: '及格' },
  { min: 50, max: 65, grade: 'C', desc: '良好', status: '及格' },
  { min: 35, max: 49, grade: 'D', desc: '满意', status: '及格' },
  { min: 20, max: 34, grade: 'E', desc: '达标', status: '及格' },
  { min: 0, max: 19, grade: 'F', desc: '未达标', status: '不及格' }
];

export default function App() {
  const [fbUser, setFbUser] = useState(null);
  const [loggedUser, setLoggedUser] = useState(null); 
  const [loginView, setLoginView] = useState('main'); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [rawStudents, setRawStudents] = useState([]);
  const [rawExams, setRawExams] = useState([]);
  const [rawScores, setRawScores] = useState([]);
  const [rawLogs, setRawLogs] = useState([]);
  
  const [activeTab, setActiveTab] = useState('dashboard'); 
  
  // 教师管理状态
  const [teachers, setTeachers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newTeacher, setNewTeacher] = useState({ username: '', password: '', name: '' });
  const [resetTeacherPassword, setResetTeacherPassword] = useState({ id: '', newPassword: '' });
  const [migrationTarget, setMigrationTarget] = useState('');

  // 基础数据添加表单
  const [studentInputMode, setStudentInputMode] = useState('batch'); 
  const [bulkInput, setBulkInput] = useState('');
  const [newStudent, setNewStudent] = useState({ studentId: '', englishName: '', chineseName: '', gender: '男', class: '' });
  const [newExam, setNewExam] = useState({ name: '' });

  // 成绩批量录入状态
  const [entryClass, setEntryClass] = useState('');
  const [entryExamId, setEntryExamId] = useState('');
  const [draftScores, setDraftScores] = useState({});

  // 个人统计图表状态
  const [chartClass, setChartClass] = useState('');
  const [chartStudentId, setChartStudentId] = useState('');

  // 班级深度分析状态
  const [analysisClass, setAnalysisClass] = useState('');
  const [analysisExamId, setAnalysisExamId] = useState('');

  // 自定义提示框状态 (替代 alert 和 confirm)
  const [systemMessage, setSystemMessage] = useState(null); // { text, type: 'success' | 'error' }
  const [confirmAction, setConfirmAction] = useState(null); // { text, action: function }

  const showMsg = (text, type = 'success') => setSystemMessage({ text, type });
  const askConfirm = (text, action) => setConfirmAction({ text, action });

  // 根据当前登录的用户进行数据隔离过滤
  const students = React.useMemo(() => {
    if (!loggedUser) return [];
    if (loggedUser.role === 'admin') return rawStudents;
    return rawStudents.filter(s => s.teacherId === loggedUser.id);
  }, [rawStudents, loggedUser]);

  const exams = React.useMemo(() => {
    if (!loggedUser) return [];
    if (loggedUser.role === 'admin') return rawExams;
    return rawExams.filter(e => e.teacherId === loggedUser.id);
  }, [rawExams, loggedUser]);

  const scores = React.useMemo(() => {
    if (!loggedUser) return [];
    if (loggedUser.role === 'admin') return rawScores;
    return rawScores.filter(s => s.teacherId === loggedUser.id);
  }, [rawScores, loggedUser]);

  const logs = React.useMemo(() => {
    if (!loggedUser) return [];
    if (loggedUser.role === 'admin') return rawLogs;
    return rawLogs.filter(l => l.teacherId === loggedUser.id);
  }, [rawLogs, loggedUser]);

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => { 
      try {
        await signInAnonymously(auth); 
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFbUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!fbUser || !db) return;
    
    const unsubScores = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'scores'), 
      (snap) => setRawScores(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))), 
      (err) => console.error("Scores error:", err)
    );
    
    const unsubStudents = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'students'), 
      (snap) => setRawStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))), 
      (err) => console.error("Students error:", err)
    );
    
    const unsubExams = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'exams'), 
      (snap) => setRawExams(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))), 
      (err) => console.error("Exams error:", err)
    );
    
    const unsubTeachers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'teachers'), 
      (snap) => setTeachers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))), 
      (err) => console.error("Teachers error:", err)
    );

    const unsubLogs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), 
      (snap) => {
        const logsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        logsData.sort((a, b) => new Date(b.time) - new Date(a.time));
        setRawLogs(logsData);
      }, 
      (err) => console.error("Logs error:", err)
    );
    
    return () => { unsubScores(); unsubStudents(); unsubExams(); unsubTeachers(); unsubLogs(); };
  }, [fbUser]);

  const addLog = async (action, customUser = null) => {
    const actingUser = customUser || loggedUser;
    const logData = { 
      time: new Date().toISOString(), 
      user: actingUser ? actingUser.name : 'System', 
      teacherId: actingUser ? actingUser.id : null,
      action 
    };
    if (db && fbUser) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'logs', Date.now().toString()), logData);
    }
  };

  const handleTeacherLogin = (e) => { 
    e.preventDefault(); 
    if (username.trim() && password.trim()) { 
      const teacher = teachers.find(t => t.username === username.trim() && t.password === password.trim());
      if (teacher) {
        const newUser = { role: 'teacher', id: teacher.id, name: teacher.name, username: teacher.username };
        setLoggedUser(newUser); 
        setIsAdmin(false);
        addLog(`教师登录系统: ${teacher.name}`, newUser); 
        setLoginError(''); 
        setUsername(''); 
        setPassword('');
      } else {
        setLoginError('用户名或密码错误。'); 
      }
    } else {
      setLoginError('请输入用户名和密码。'); 
    }
  };
  
  const handleAdminLogin = (e) => { 
    e.preventDefault(); 
    if (password === ADMIN_PASSWORD) { 
      const newUser = { role: 'admin', id: 'admin', name: '系统管理员' };
      setLoggedUser(newUser); 
      setIsAdmin(true);
      setActiveTab('admin-panel');
      addLog('管理员登录', newUser); 
      setLoginError(''); 
      setPassword(''); 
      setLoginView('main'); 
    } else {
      setLoginError('管理员密码错误。'); 
    }
  };
  
  const handleSecurityCheck = (e) => { 
    e.preventDefault(); 
    if (securityAnswer.trim() === SECURITY_ANSWER) { 
      showMsg(`验证成功！请直接登录。`); 
      setLoginView('main'); 
      setSecurityAnswer(''); 
      setLoginError(''); 
    } else {
      setLoginError('回答错误。'); 
    }
  };
  
  const handleLogout = () => { 
    addLog('退出登录'); 
    setLoggedUser(null); 
    setIsAdmin(false);
    setActiveTab('dashboard'); 
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!newTeacher.username.trim() || !newTeacher.password.trim() || !newTeacher.name.trim()) {
      return showMsg('请填写完整的教师信息', 'error');
    }
    if (teachers.some(t => t.username === newTeacher.username.trim())) {
      return showMsg('用户名已存在，请使用其他用户名', 'error');
    }

    const id = Date.now().toString();
    if (db && fbUser) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teachers', id), { 
        ...newTeacher, 
        id,
        createdAt: new Date().toISOString()
      });
      showMsg(`已成功添加教师账户: ${newTeacher.name}`);
      addLog(`管理员添加了教师: ${newTeacher.name}`);
      setNewTeacher({ username: '', password: '', name: '' });
    }
  };

  const handleDeleteTeacher = (id, name) => {
    askConfirm(`确定要删除教师【${name}】的账户吗？此操作不可撤销。`, async () => {
      if (db && fbUser) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teachers', id));
        showMsg(`教师 ${name} 的账户已删除。`);
        addLog(`管理员删除了教师: ${name}`);
      }
    });
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetTeacherPassword.id || !resetTeacherPassword.newPassword.trim()) {
      return showMsg('请选择教师并输入新密码', 'error');
    }
    
    askConfirm('确定要重置该教师的密码吗？', async () => {
      if (db && fbUser) {
        const teacherRef = doc(db, 'artifacts', appId, 'public', 'data', 'teachers', resetTeacherPassword.id);
        await setDoc(teacherRef, { password: resetTeacherPassword.newPassword.trim() }, { merge: true });
        
        const teacherName = teachers.find(t => t.id === resetTeacherPassword.id)?.name || '未知教师';
        showMsg(`已成功重置 ${teacherName} 的密码。`);
        addLog(`管理员重置了教师密码: ${teacherName}`);
        setResetTeacherPassword({ id: '', newPassword: '' });
      }
    });
  };

  const handleMigrateData = () => {
    if (!migrationTarget) return showMsg('请先选择目标教师', 'error');
    const targetTeacher = teachers.find(t => t.id === migrationTarget);
    if (!targetTeacher) return;

    askConfirm(`确定要将所有【未绑定】的旧数据全部分配给教师 ${targetTeacher.name} 吗？此操作不可逆。`, async () => {
      let opCount = 0;
      let totalCount = 0;
      const chunks = [];
      let currentBatch = (db && fbUser) ? writeBatch(db) : null;
      if (!currentBatch) return;

      const addToBatch = (collName, docId) => {
        currentBatch.update(doc(db, 'artifacts', appId, 'public', 'data', collName, docId), { teacherId: migrationTarget });
        opCount++;
        totalCount++;
        // Firestore batch limits to 500, we chunk at 450 to be safe
        if (opCount >= 450) {
          chunks.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          opCount = 0;
        }
      };

      const isUnassigned = (item) => !item.teacherId;

      rawStudents.filter(isUnassigned).forEach(s => addToBatch('students', s.id));
      rawExams.filter(isUnassigned).forEach(e => addToBatch('exams', e.id));
      rawScores.filter(isUnassigned).forEach(s => addToBatch('scores', s.id));
      rawLogs.filter(isUnassigned).forEach(l => addToBatch('logs', l.id));

      if (totalCount === 0) {
        return showMsg('没有发现需要分配的无主/旧数据。', 'error');
      }

      try {
        if (opCount > 0) chunks.push(currentBatch.commit());
        await Promise.all(chunks);
        showMsg(`迁移成功！共将 ${totalCount} 条数据分配给了 ${targetTeacher.name}。`);
        addLog(`管理员将旧数据迁移给了教师: ${targetTeacher.name}`);
        setMigrationTarget('');
      } catch (err) {
        console.error(err);
        showMsg('数据迁移失败，请重试', 'error');
      }
    });
  };

  const handleBulkImport = async () => {
    if(!bulkInput.trim()) return showMsg("请先在文本框中粘贴 Excel 数据！", 'error');
    const rows = bulkInput.trim().split('\n');
    let addedCount = 0;
    const batch = (db && fbUser) ? writeBatch(db) : null;
    
    rows.forEach((row, index) => {
      const cols = row.split('\t'); 
      if (cols.length >= 5) {
        const studentData = { 
          studentId: cols[0].trim(), 
          englishName: cols[1].trim(), 
          chineseName: cols[2].trim(), 
          gender: cols[3].trim(), 
          class: cols[4].trim(),
          teacherId: loggedUser.id
        };
        const id = Date.now().toString() + index; 
        if (batch) batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'students', id), { ...studentData, id });
        addedCount++;
      }
    });
    
    if (addedCount === 0) return showMsg("没有读取到有效数据，请检查格式。", 'error');
    try {
      if (batch) await batch.commit();
      addLog(`导入了 ${addedCount} 名学生`); 
      setBulkInput(''); 
      showMsg(`成功导入 ${addedCount} 名学生！`);
    } catch(err) { 
      showMsg("导入错误。", 'error'); 
      console.error(err);
    }
  };

  const handleAddSingleStudent = async (e) => {
    e.preventDefault();
    const id = Date.now().toString();
    if (db && fbUser) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', id), { ...newStudent, teacherId: loggedUser.id, id });
    showMsg(`已添加学生: ${newStudent.chineseName}`);
    setNewStudent({ studentId: '', englishName: '', chineseName: '', gender: '男', class: '' });
  };
  
  const handleDeleteStudent = (id) => { 
    askConfirm('确定删除此学生吗？', async () => {
      if (db && fbUser) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', id)); 
      showMsg('学生已删除。');
    });
  };
  
  const handleAddExam = async (e) => { 
    e.preventDefault(); 
    if (!newExam.name.trim()) return;
    const id = Date.now().toString(); 
    if (db && fbUser) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'exams', id), { ...newExam, teacherId: loggedUser.id, id }); 
    showMsg(`已添加考试项目: ${newExam.name}`);
    setNewExam({ name: '' }); 
  };
  
  const handleDeleteExam = (id) => { 
    askConfirm('确定删除该考试项目吗？', async () => {
      if (db && fbUser) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'exams', id)); 
      showMsg('考试项目已删除。');
    });
  };

  useEffect(() => {
    if (entryClass && entryExamId) {
      const currentStudents = students.filter(s => s.class === entryClass);
      const newDrafts = {};
      currentStudents.forEach(s => {
        const existing = scores.find(score => score.studentId === s.id && score.examId === entryExamId);
        newDrafts[s.id] = {
          partA: existing ? existing.partA : '',
          partB: existing ? existing.partB : '',
          partC: existing ? existing.partC : '',
          partD: existing ? existing.partD : '',
          docId: existing ? existing.id : `${s.id}_${entryExamId}`
        };
      });
      setDraftScores(newDrafts);
    } else {
      setDraftScores({});
    }
  }, [entryClass, entryExamId, students, scores]);

  const handleScoreChange = (studentId, field, value) => {
    setDraftScores(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const handleSaveBatchScores = async () => {
    const batch = (db && fbUser) ? writeBatch(db) : null;
    let savedCount = 0;

    for (const [studentId, draft] of Object.entries(draftScores)) {
      if (draft.partA !== '' || draft.partB !== '' || draft.partC !== '' || draft.partD !== '') {
        const scoreData = {
          studentId,
          examId: entryExamId,
          partA: Number(draft.partA || 0),
          partB: Number(draft.partB || 0),
          partC: Number(draft.partC || 0),
          partD: Number(draft.partD || 0),
          teacherId: loggedUser.id
        };
        if (batch) {
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'scores', draft.docId), scoreData);
        }
        savedCount++;
      }
    }
    if (batch) {
      try {
        await batch.commit();
        addLog(`批量保存了 ${entryClass} 的成绩`);
        showMsg(`成功保存了 ${savedCount} 名学生的成绩！`);
      } catch (err) {
        console.error("Save scores error:", err);
        showMsg("保存成绩失败，请重试。", 'error');
      }
    }
  };

  const calculateResult = (partA = 0, partB = 0, partC = 0, partD = 0) => {
    const sum = Number(partA) + Number(partB) + Number(partC) + Number(partD);
    const total = sum * 2;
    const gradeInfo = GRADE_RANGES.find(g => total >= g.min && total <= g.max) || GRADE_RANGES[GRADE_RANGES.length - 1];
    return { sum, total, grade: gradeInfo.grade, status: gradeInfo.status };
  };

  const getDetailedStudentChartData = (studentId) => {
    const studentScores = scores.filter(s => s.studentId === studentId);
    return exams.map(exam => {
      const score = studentScores.find(s => s.examId === exam.id);
      if (!score) return null;
      const calc = calculateResult(score.partA, score.partB, score.partC, score.partD);
      return { 
        name: exam.name, 
        total: calc.total,
        partA: score.partA || 0,
        partB: score.partB || 0,
        partC: score.partC || 0,
        partD: score.partD || 0,
        grade: calc.grade,
        status: calc.status
      };
    }).filter(item => item !== null);
  };

  const getClassChartData = (className) => {
    const classStudents = className === '全部' ? students : students.filter(s => s.class === className);
    const studentIds = classStudents.map(s => s.id);
    return exams.map(exam => {
      const examScores = scores.filter(s => s.examId === exam.id && studentIds.includes(s.studentId));
      if (examScores.length === 0) return { name: exam.name, '平均分': 0 };
      const totalMarks = examScores.reduce((sum, score) => sum + calculateResult(score.partA, score.partB, score.partC, score.partD).total, 0);
      return { name: exam.name, '平均分': Number((totalMarks / examScores.length).toFixed(1)) };
    });
  };

  const handleExportAnalysisExcel = () => {
    if (!analysisClass || !analysisExamId) return showMsg('请先选择班级和考试', 'error');

    const examName = exams.find(e => e.id === analysisExamId)?.name || '未命名考试';
    const classStudents = students.filter(s => s.class === analysisClass);
    
    const classScores = classStudents.map(student => {
      const score = scores.find(s => s.studentId === student.id && s.examId === analysisExamId);
      const hasTaken = !!score && (score.partA !== '' || score.partB !== '');
      const calc = hasTaken ? calculateResult(score.partA, score.partB, score.partC, score.partD) : null;
      return { student, score, calc, hasTaken };
    }).filter(item => item.hasTaken);

    let csvContent = '\uFEFF'; 
    csvContent += `${analysisClass} 班级 - ${examName} 深度分析报告\n\n`;

    // 1. 各部分成绩分布
    csvContent += '【各部分得分分布】\n';
    csvContent += '部分,满分,优秀(80%以上)人数,及格(50%-79%)人数,待加强(50%以下)人数\n';
    
    const getDist = (key, max) => {
      let e = 0, p = 0, f = 0;
      classScores.forEach(item => {
        const pct = Number(item.score[key] || 0) / max;
        if (pct >= 0.8) e++; else if (pct >= 0.5) p++; else f++;
      });
      return [e, p, f];
    };
    csvContent += `A部分,10,${getDist('partA', 10).join(',')}\n`;
    csvContent += `B部分,15,${getDist('partB', 15).join(',')}\n`;
    csvContent += `C部分,10,${getDist('partC', 10).join(',')}\n`;
    csvContent += `D部分,15,${getDist('partD', 15).join(',')}\n\n`;

    // 2. 优异名单 (A, B)
    csvContent += '【成绩优异名单 (A / B等)】\n';
    csvContent += '姓名,性别,总分,等级\n';
    classScores.filter(i => i.calc.grade === 'A' || i.calc.grade === 'B').forEach(i => {
      csvContent += `${i.student.chineseName},${i.student.gender},${i.calc.total},${i.calc.grade}\n`;
    });
    csvContent += '\n';

    // 3. 不及格名单 (F)
    csvContent += '【不及格名单 (F等)】\n';
    csvContent += '姓名,性别,总分,等级\n';
    classScores.filter(i => i.calc.grade === 'F').forEach(i => {
      csvContent += `${i.student.chineseName},${i.student.gender},${i.calc.total},${i.calc.grade}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${analysisClass}_${examName}_深度分析.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog(`导出了 ${analysisClass} 的深度分析报告`);
    showMsg('深度分析报告导出成功。');
  };

  const handleExportExcel = () => {
    if (!entryClass || !entryExamId) return showMsg('请先选择班级和考试', 'error');

    const classStudents = students.filter(s => s.class === entryClass).sort((a, b) => (a.englishName || '').localeCompare(b.englishName || ''));
    const examName = exams.find(e => e.id === entryExamId)?.name || '未命名考试';

    let csvContent = '\uFEFF'; 
    csvContent += '学号,姓名,A部分 (10),B部分 (15),C部分 (10),D部分 (15),卷面总分(50),最终得分(100),等级\n';

    classStudents.forEach(student => {
      const draft = draftScores[student.id] || {};
      const calc = calculateResult(draft.partA, draft.partB, draft.partC, draft.partD);
      const hasInput = draft.partA !== '' || draft.partB !== '' || draft.partC !== '' || draft.partD !== '';

      const row = [
        student.studentId,
        student.chineseName,
        draft.partA || '',
        draft.partB || '',
        draft.partC || '',
        draft.partD || '',
        hasInput ? calc.sum : '',
        hasInput ? calc.total : '',
        hasInput ? calc.grade : ''
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${entryClass}_${examName}_成绩分析.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog(`导出了 ${entryClass} 的Excel成绩`);
    showMsg('成绩报表导出成功。');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const inputs = Array.from(document.querySelectorAll('.score-input'));
      const currentIndex = inputs.indexOf(e.target);
      
      if (currentIndex > -1) {
        let nextIndex = e.key === 'ArrowRight' ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex >= 0 && nextIndex < inputs.length) {
          e.preventDefault(); 
          inputs[nextIndex].focus();
          inputs[nextIndex].select();
        }
      }
    }
  };

  if (!loggedUser) {
    return (
      <div className="min-h-screen bg-[#f4f1ea] flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Alerts for unauthenticated state */}
        {systemMessage && (
          <div className="fixed top-6 right-6 z-50 bg-white border-l-4 border-emerald-500 shadow-xl rounded-lg p-4 flex items-center gap-3 animate-fadeIn">
            {systemMessage.type === 'error' ? <AlertCircle className="text-red-500 w-5 h-5" /> : <CheckCircle className="text-emerald-500 w-5 h-5" />}
            <span className="text-sm font-medium text-stone-700">{systemMessage.text}</span>
            <button onClick={() => setSystemMessage(null)} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4"/></button>
          </div>
        )}
        
        <Leaf className="absolute top-10 left-10 w-32 h-32 text-emerald-600/10 -rotate-45" />
        <Leaf className="absolute bottom-10 right-10 w-48 h-48 text-emerald-600/10 rotate-45" />
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-stone-200 relative z-10">
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-10 text-center">
            <Sprout className="w-16 h-16 text-emerald-100 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white tracking-tight">华文科试卷分析记录</h1>
          </div>
          <div className="p-8 bg-stone-50/50">
            {loginError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                {loginError}
              </div>
            )}
            
            {loginView === 'main' && (
              <form onSubmit={handleTeacherLogin} className="space-y-5">
                <input 
                  type="text" 
                  className="block w-full px-4 py-3 bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" 
                  placeholder="用户名 (如: ali_teacher)" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                />
                <input 
                  type="password" 
                  className="block w-full px-4 py-3 bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors" 
                  placeholder="登录密码" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                />
                <button type="submit" className="w-full py-3 px-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm">
                  教师登录
                </button>
                <button type="button" onClick={() => setLoginView('admin')} className="text-stone-500 font-medium text-sm flex items-center justify-center w-full mt-4 hover:text-stone-700 transition-colors">
                  <Lock className="w-3 h-3 mr-1" /> 管理员入口
                </button>
              </form>
            )}
            
            {loginView === 'admin' && (
              <form onSubmit={handleAdminLogin} className="space-y-5">
                <input 
                  type="password" 
                  className="block w-full px-4 py-3 bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-stone-800 focus:border-stone-800 transition-colors" 
                  placeholder="管理员密码" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                />
                <button type="submit" className="w-full py-3 px-4 rounded-xl font-bold text-white bg-stone-800 hover:bg-stone-900 transition-colors shadow-sm">
                  进入后台
                </button>
                <button type="button" onClick={() => setLoginView('main')} className="w-full py-2 text-sm text-stone-500 hover:text-stone-700 transition-colors font-medium">
                  返回
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  const classes = [...new Set(students.map(s => s.class))];

  return (
    <div className="min-h-screen bg-[#f4f1ea] font-sans flex text-stone-800 relative">
      
      {}
      {/* Custom System Messages (Toasts) */}
      {systemMessage && (
        <div className="fixed top-6 right-6 z-50 bg-white border-l-4 border-emerald-500 shadow-xl rounded-lg p-4 flex items-center gap-3 animate-fadeIn min-w-[250px]">
          {systemMessage.type === 'error' ? <AlertCircle className="text-red-500 w-5 h-5" /> : <CheckCircle className="text-emerald-500 w-5 h-5" />}
          <span className="text-sm font-medium text-stone-700 flex-1">{systemMessage.text}</span>
          <button onClick={() => setSystemMessage(null)} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4"/></button>
        </div>
      )}

      {/* Custom Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-fadeIn">
            <div className="flex items-center gap-3 mb-4 text-stone-800">
              <Info className="w-6 h-6 text-emerald-600" />
              <h3 className="font-bold text-lg">系统确认</h3>
            </div>
            <p className="text-stone-600 mb-6">{confirmAction.text}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmAction(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors">
                取消
              </button>
              <button 
                onClick={() => { confirmAction.action(); setConfirmAction(null); }} 
                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
              >
                确定执行
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      <style>{`
        .hide-arrows::-webkit-outer-spin-button,
        .hide-arrows::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .hide-arrows {
          -moz-appearance: textfield;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
      
      {}
      <aside className="w-64 bg-white border-r border-stone-200 hidden md:flex flex-col shadow-sm z-10">
        <div className="h-16 flex items-center px-6 bg-emerald-700 text-white">
          <Leaf className="w-6 h-6 mr-2 text-emerald-200" />
          <span className="font-bold text-xl">分析记录系统</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<BarChart2 className="w-5 h-5" />} label="系统概览" />
          {isAdmin && (
            <NavItem active={activeTab === 'admin-panel'} onClick={() => setActiveTab('admin-panel')} icon={<Lock className="w-5 h-5 text-amber-600" />} label="管理员控制台" />
          )}
          <NavItem active={activeTab === 'manage-data'} onClick={() => setActiveTab('manage-data')} icon={<BookOpen className="w-5 h-5" />} label="1. 基础资料管理" />
          <NavItem active={activeTab === 'data-entry'} onClick={() => setActiveTab('data-entry')} icon={<Edit3 className="w-5 h-5" />} label="2. 成绩录入表格" />
          <NavItem active={activeTab === 'student-chart'} onClick={() => setActiveTab('student-chart')} icon={<TrendingUp className="w-5 h-5" />} label="3. 个人进展(Line)" />
          <NavItem active={activeTab === 'class-chart'} onClick={() => setActiveTab('class-chart')} icon={<BarChart2 className="w-5 h-5" />} label="4. 班级深度分析" />
        </nav>
        <div className="p-4 border-t border-stone-200">
          <div className="mb-4 px-4 py-2 bg-stone-50 rounded-lg text-sm text-stone-600 font-medium break-all">
            <UserCircle className="w-4 h-4 inline mr-2 text-stone-400"/>
            {loggedUser.name}
          </div>
          <button onClick={handleLogout} className="flex items-center w-full justify-center px-4 py-2.5 text-sm font-bold text-stone-600 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors">
            <LogOut className="w-4 h-4 mr-2" /> 退出登录
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <Leaf className="absolute -bottom-20 -right-20 w-96 h-96 text-emerald-600/5 -rotate-12 pointer-events-none" />
        
        <div className="flex-1 overflow-auto p-6 md:p-8 relative z-10">
          <div className="max-w-6xl mx-auto space-y-6">

            {}
            {activeTab === 'admin-panel' && isAdmin && (
              <div className="space-y-6 animate-fadeIn">
                 <h2 className="text-2xl font-bold text-stone-800 border-b-2 border-amber-500 pb-2 inline-block">系统管理员控制台</h2>
                 
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 添加新教师 */}
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 flex flex-col h-full">
                      <h3 className="font-bold text-lg text-emerald-800 mb-4 flex items-center">
                        <UserPlus className="w-5 h-5 mr-2"/>创建教师账户
                      </h3>
                      <form onSubmit={handleAddTeacher} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-stone-500 uppercase mb-1">登录用户名 (需唯一)</label>
                          <input 
                            required 
                            type="text" 
                            placeholder="如: lim_laoshi" 
                            className="w-full px-4 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-stone-50" 
                            value={newTeacher.username} 
                            onChange={e => setNewTeacher({...newTeacher, username: e.target.value})} 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-stone-500 uppercase mb-1">教师姓名 (显示名称)</label>
                          <input 
                            required 
                            type="text" 
                            placeholder="如: 林老师" 
                            className="w-full px-4 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-stone-50" 
                            value={newTeacher.name} 
                            onChange={e => setNewTeacher({...newTeacher, name: e.target.value})} 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-stone-500 uppercase mb-1">初始登录密码</label>
                          <input 
                            required 
                            type="text" 
                            placeholder="设置密码" 
                            className="w-full px-4 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-stone-50" 
                            value={newTeacher.password} 
                            onChange={e => setNewTeacher({...newTeacher, password: e.target.value})} 
                          />
                        </div>
                        <button type="submit" className="w-full bg-emerald-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm mt-2">
                          添加新教师
                        </button>
                      </form>
                    </div>

                    {/* 管理教师列表 & 重置密码 */}
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 flex flex-col h-full">
                      <h3 className="font-bold text-lg text-amber-800 mb-4 flex items-center">
                        <KeyRound className="w-5 h-5 mr-2"/>教师账户管理 & 密码重置
                      </h3>
                      
                      <form onSubmit={handleResetPassword} className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-100 flex flex-col gap-3">
                        <div className="text-sm font-bold text-amber-800 mb-1">强制重置密码</div>
                        <div className="flex gap-2">
                          <select 
                            className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                            value={resetTeacherPassword.id}
                            onChange={e => setResetTeacherPassword({...resetTeacherPassword, id: e.target.value})}
                          >
                            <option value="">选择需要重置的教师...</option>
                            {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.username})</option>)}
                          </select>
                          <input 
                            type="text" 
                            placeholder="新密码"
                            className="w-1/3 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                            value={resetTeacherPassword.newPassword}
                            onChange={e => setResetTeacherPassword({...resetTeacherPassword, newPassword: e.target.value})}
                          />
                        </div>
                        <button type="submit" className="self-end bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors shadow-sm">
                          执行重置
                        </button>
                      </form>

                      <div className="flex-1 overflow-y-auto border border-stone-100 rounded-xl max-h-[300px]">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-stone-100 sticky top-0 text-stone-600 shadow-sm z-10">
                            <tr>
                              <th className="px-4 py-2.5 font-bold">教师姓名</th>
                              <th className="px-4 py-2.5 font-bold">登录账号</th>
                              <th className="px-4 py-2.5 font-bold text-right">操作</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {teachers.length === 0 ? (
                               <tr><td colSpan="3" className="px-4 py-8 text-center text-stone-400">暂无教师账户</td></tr>
                            ) : (
                              teachers.map(t => (
                                <tr key={t.id} className="hover:bg-stone-50 transition-colors">
                                  <td className="px-4 py-2.5 font-bold text-stone-700">{t.name}</td>
                                  <td className="px-4 py-2.5 font-mono text-stone-500">{t.username}</td>
                                  <td className="px-4 py-2.5 text-right">
                                    <button onClick={() => handleDeleteTeacher(t.id, t.name)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors" title="删除账户">
                                      <Trash2 className="w-4 h-4 inline"/>
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                 </div>

                 {/* 数据迁移工具 */}
                 <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mt-8">
                    <h3 className="font-bold text-lg text-emerald-800 mb-2 flex items-center">
                      <Database className="w-5 h-5 mr-2"/>旧数据迁移工具 (分配无主数据)
                    </h3>
                    <p className="text-sm text-stone-500 mb-4">
                      系统升级多用户之前录入的旧数据（学生、考试、成绩）没有绑定具体的教师。您可以在此处将这些“无主”数据一键归入选定的教师账号下（例如分配给 suelane 老师）。
                    </p>
                    <div className="flex flex-col md:flex-row gap-4 md:w-2/3">
                      <select 
                        className="flex-1 px-4 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-stone-50"
                        value={migrationTarget}
                        onChange={e => setMigrationTarget(e.target.value)}
                      >
                        <option value="">请选择要接收旧数据的教师...</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.username})</option>)}
                      </select>
                      <button 
                        onClick={handleMigrateData}
                        className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm whitespace-nowrap"
                      >
                        一键分配旧数据
                      </button>
                    </div>
                 </div>
              </div>
            )}

            {}
            {activeTab === 'manage-data' && (
              <div className="space-y-6 animate-fadeIn">
                 <h2 className="text-2xl font-bold text-stone-800 border-b-2 border-emerald-500 pb-2 inline-block">第一步: 输入试卷与学生资料</h2>
                 
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 考试管理 */}
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 flex flex-col h-full">
                      <h3 className="font-bold text-lg text-amber-800 mb-4 flex items-center">
                        <BookOpen className="w-5 h-5 mr-2"/>1. 考试项目管理
                      </h3>
                      <form onSubmit={handleAddExam} className="flex gap-2 mb-6">
                        <input 
                          required 
                          type="text" 
                          placeholder="考试名称 (如 模拟考3)" 
                          className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" 
                          value={newExam.name} 
                          onChange={e => setNewExam({name: e.target.value})} 
                        />
                        <button type="submit" className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-amber-700 transition-colors shadow-sm">添加</button>
                      </form>
                      <div className="flex-1 overflow-y-auto border border-stone-100 rounded-xl max-h-[400px]">
                        {exams.length === 0 ? (
                           <div className="p-8 text-center text-stone-400 text-sm">暂无考试数据</div>
                        ) : (
                          exams.map(e => (
                            <div key={e.id} className="flex justify-between items-center p-3 border-b border-stone-100 hover:bg-stone-50 transition-colors">
                              <div className="text-sm font-bold text-stone-700">{e.name}</div>
                              <button onClick={() => handleDeleteExam(e.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors" title="删除">
                                <Trash2 className="w-4 h-4"/>
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* 学生管理 */}
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 flex flex-col h-full">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-emerald-800 flex items-center">
                          <Users className="w-5 h-5 mr-2"/>2. 学生资料录入
                        </h3>
                        <div className="flex bg-stone-100 rounded-lg p-1">
                          <button 
                            onClick={() => setStudentInputMode('batch')} 
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${studentInputMode === 'batch' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                          >
                            Excel 粘贴
                          </button>
                          <button 
                            onClick={() => setStudentInputMode('single')} 
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${studentInputMode === 'single' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                          >
                            手动录入
                          </button>
                        </div>
                      </div>
                      
                      {studentInputMode === 'batch' ? (
                        <div className="mb-6">
                          <p className="text-xs text-stone-500 mb-2 flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1"/> 复制5列：
                            <span className="font-mono bg-stone-100 px-1 py-0.5 rounded ml-1 border border-stone-200">学号 | 英文名 | 中文名 | 性别 | 班级</span>
                          </p>
                          <textarea 
                            value={bulkInput} 
                            onChange={(e) => setBulkInput(e.target.value)} 
                            className="w-full h-32 p-3 text-xs border border-stone-300 rounded-xl mb-3 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none" 
                            placeholder="1001&#9;Ali&#9;阿里&#9;男&#9;5A&#10;1002&#9;Abu&#9;阿布&#9;男&#9;5A" 
                          />
                          <button 
                            onClick={handleBulkImport} 
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex justify-center items-center transition-colors shadow-sm"
                          >
                            <ClipboardList className="w-4 h-4 mr-2" /> 确认批量导入
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={handleAddSingleStudent} className="mb-6 space-y-3 bg-stone-50 p-4 rounded-xl border border-stone-100">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">学号</label>
                              <input required type="text" placeholder="如: 1001" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" value={newStudent.studentId} onChange={e => setNewStudent({...newStudent, studentId: e.target.value})} />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">班级</label>
                              <input required type="text" placeholder="如: 5A" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" value={newStudent.class} onChange={e => setNewStudent({...newStudent, class: e.target.value})} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">中文名</label>
                              <input required type="text" placeholder="中文姓名" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" value={newStudent.chineseName} onChange={e => setNewStudent({...newStudent, chineseName: e.target.value})} />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">英文名</label>
                              <input required type="text" placeholder="English Name" className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" value={newStudent.englishName} onChange={e => setNewStudent({...newStudent, englishName: e.target.value})} />
                            </div>
                          </div>
                          <div className="flex gap-3 pt-1">
                            <div className="w-1/3">
                              <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">性别</label>
                              <select className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none" value={newStudent.gender} onChange={e => setNewStudent({...newStudent, gender: e.target.value})}>
                                <option>男</option>
                                <option>女</option>
                              </select>
                            </div>
                            <div className="w-2/3 flex items-end">
                              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm h-[38px]">单人添加</button>
                            </div>
                          </div>
                        </form>
                      )}
                      
                      <div className="flex-1 max-h-[300px] overflow-y-auto border border-stone-200 rounded-xl shadow-sm">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-stone-100 sticky top-0 text-stone-600 shadow-sm z-10">
                            <tr>
                              <th className="px-4 py-2.5 font-bold">学号</th>
                              <th className="px-4 py-2.5 font-bold">中文名(班级)</th>
                              <th className="px-4 py-2.5 font-bold text-right">操作</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {students.length === 0 ? (
                               <tr><td colSpan="3" className="px-4 py-8 text-center text-stone-400">暂无学生数据，请先添加</td></tr>
                            ) : (
                              [...students].sort((a, b) => (a.englishName || '').localeCompare(b.englishName || '')).map(s => (
                                <tr key={s.id} className="hover:bg-stone-50 transition-colors">
                                  <td className="px-4 py-2.5 font-mono text-stone-500">{s.studentId}</td>
                                  <td className="px-4 py-2.5 font-bold text-stone-700">{s.chineseName} <span className="text-stone-400 font-normal">({s.class})</span></td>
                                  <td className="px-4 py-2.5 text-right">
                                    <button onClick={() => handleDeleteStudent(s.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors" title="删除该学生">
                                      <Trash2 className="w-4 h-4 inline"/>
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                 </div>
              </div>
            )}

            {}
            {activeTab === 'data-entry' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex justify-between items-end border-b-2 border-emerald-500 pb-2">
                  <h2 className="text-2xl font-bold text-stone-800">第二步: 智能录入表格</h2>
                  {entryClass && entryExamId && (
                    <div className="flex gap-3">
                      <button onClick={handleExportExcel} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center shadow-md hover:bg-blue-700 transition-colors active:scale-95">
                        <Download className="w-4 h-4 mr-2" /> 导出 Excel
                      </button>
                      <button onClick={handleSaveBatchScores} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center shadow-md hover:bg-emerald-700 transition-colors active:scale-95">
                        <Save className="w-4 h-4 mr-2" /> 一键保存全班成绩
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                  <div className="p-6 bg-stone-50 border-b border-stone-200 flex flex-wrap gap-6 items-center">
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase mb-2">1. 选择班级</label>
                      <select 
                        value={entryClass} 
                        onChange={e => setEntryClass(e.target.value)} 
                        className="w-48 px-4 py-2.5 border border-stone-300 rounded-xl text-sm bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                      >
                        <option value="">请选择班级...</option>
                        {classes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase mb-2">2. 选择考试项目</label>
                      <select 
                        value={entryExamId} 
                        onChange={e => setEntryExamId(e.target.value)} 
                        className="w-56 px-4 py-2.5 border border-stone-300 rounded-xl text-sm bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                      >
                        <option value="">请选择模拟考试...</option>
                        {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {entryClass && entryExamId ? (
                    <div className="overflow-x-auto max-h-[60vh]">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-emerald-700 text-white sticky top-0 z-10 shadow-sm">
                          <tr>
                            <th className="px-4 py-3.5 font-bold border-r border-emerald-600">学号</th>
                            <th className="px-4 py-3.5 font-bold border-r border-emerald-600">姓名</th>
                            <th className="px-2 py-3.5 font-bold text-center border-r border-emerald-600 w-24">A (10分)</th>
                            <th className="px-2 py-3.5 font-bold text-center border-r border-emerald-600 w-24">B (15分)</th>
                            <th className="px-2 py-3.5 font-bold text-center border-r border-emerald-600 w-24">C (10分)</th>
                            <th className="px-2 py-3.5 font-bold text-center border-r border-emerald-600 w-24">D (15分)</th>
                            <th className="px-4 py-3.5 font-bold text-center bg-emerald-800">卷面分(50)</th>
                            <th className="px-4 py-3.5 font-bold text-center bg-emerald-900">总分(100)</th>
                            <th className="px-4 py-3.5 font-bold text-center bg-emerald-900">等级</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200">
                          {students
                            .filter(s => s.class === entryClass)
                            .sort((a, b) => (a.englishName || '').localeCompare(b.englishName || ''))
                            .map((student, idx) => {
                              const draft = draftScores[student.id] || {};
                              const calc = calculateResult(draft.partA, draft.partB, draft.partC, draft.partD);
                              const hasInput = draft.partA !== '' || draft.partB !== '' || draft.partC !== '' || draft.partD !== '';
                              
                              return (
                                <tr key={student.id} className={`hover:bg-emerald-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-stone-50'}`}>
                                  <td className="px-4 py-3 font-mono text-stone-500 border-r border-stone-200">{student.studentId}</td>
                                  <td className="px-4 py-3 font-bold text-stone-800 border-r border-stone-200">{student.chineseName}</td>
                                  
                                  <td className="px-2 py-2 border-r border-stone-200">
                                    <input 
                                      type="number" min="0" max="10" placeholder="-" 
                                      className="score-input hide-arrows w-full px-2 py-2 text-center border border-stone-300 rounded bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
                                      value={draft.partA || ''} 
                                      onChange={e => handleScoreChange(student.id, 'partA', e.target.value)} 
                                      onKeyDown={handleKeyDown}
                                    />
                                  </td>
                                  <td className="px-2 py-2 border-r border-stone-200">
                                    <input 
                                      type="number" min="0" max="15" placeholder="-" 
                                      className="score-input hide-arrows w-full px-2 py-2 text-center border border-stone-300 rounded bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
                                      value={draft.partB || ''} 
                                      onChange={e => handleScoreChange(student.id, 'partB', e.target.value)} 
                                      onKeyDown={handleKeyDown}
                                    />
                                  </td>
                                  <td className="px-2 py-2 border-r border-stone-200">
                                    <input 
                                      type="number" min="0" max="10" placeholder="-" 
                                      className="score-input hide-arrows w-full px-2 py-2 text-center border border-stone-300 rounded bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
                                      value={draft.partC || ''} 
                                      onChange={e => handleScoreChange(student.id, 'partC', e.target.value)} 
                                      onKeyDown={handleKeyDown}
                                    />
                                  </td>
                                  <td className="px-2 py-2 border-r border-stone-200">
                                    <input 
                                      type="number" min="0" max="15" placeholder="-" 
                                      className="score-input hide-arrows w-full px-2 py-2 text-center border border-stone-300 rounded bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
                                      value={draft.partD || ''} 
                                      onChange={e => handleScoreChange(student.id, 'partD', e.target.value)} 
                                      onKeyDown={handleKeyDown}
                                    />
                                  </td>

                                  <td className="px-4 py-3 text-center text-stone-600 font-bold bg-stone-100/50">{hasInput ? calc.sum : '-'}</td>
                                  <td className="px-4 py-3 text-center text-emerald-700 font-extrabold text-lg bg-emerald-50/50">{hasInput ? calc.total : '-'}</td>
                                  <td className="px-4 py-3 text-center bg-emerald-50/50">
                                    {hasInput ? (
                                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${calc.grade === 'F' ? 'bg-red-100 text-red-700' : 'bg-emerald-200 text-emerald-800'}`}>
                                        {calc.grade}
                                      </span>
                                    ) : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-20 text-center text-stone-400">
                      <div className="bg-stone-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ClipboardList className="w-10 h-10 text-stone-300" />
                      </div>
                      <p className="font-medium text-stone-500">请在上方选择班级和考试项目</p>
                      <p className="text-sm mt-1">系统将自动为您生成该班级的成绩批量录入表格，学生姓名已按 A-Z 排序。</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {}
            {activeTab === 'student-chart' && (
              <div className="space-y-6 animate-fadeIn">
                <h2 className="text-2xl font-bold text-stone-800 border-b-2 border-emerald-500 pb-2 inline-block">学生个人成绩及多维度进展 (折线图)</h2>
                
                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                  <div className="p-6 bg-stone-50 border-b border-stone-200 flex flex-wrap gap-6 items-center">
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase mb-2">1. 选择班级</label>
                      <select 
                        value={chartClass} 
                        onChange={e => { setChartClass(e.target.value); setChartStudentId(''); }} 
                        className="w-48 px-4 py-2.5 border border-stone-300 rounded-xl text-sm bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                      >
                        <option value="">请选择班级...</option>
                        {classes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase mb-2">2. 选择学生</label>
                      <select 
                        value={chartStudentId} 
                        onChange={e => setChartStudentId(e.target.value)} 
                        disabled={!chartClass}
                        className="w-56 px-4 py-2.5 border border-stone-300 rounded-xl text-sm bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm disabled:opacity-50"
                      >
                        <option value="">请选择学生...</option>
                        {students
                          .filter(s => s.class === chartClass)
                          .sort((a, b) => (a.englishName || '').localeCompare(b.englishName || ''))
                          .map(s => <option key={s.id} value={s.id}>{s.chineseName} ({s.englishName})</option>)
                        }
                      </select>
                    </div>
                  </div>
                  
                  {chartClass && chartStudentId ? (() => {
                    const studentData = getDetailedStudentChartData(chartStudentId);
                    const selectedStudent = students.find(s => s.id === chartStudentId);
                    
                    if (studentData.length === 0) {
                       return <div className="p-16 text-center text-stone-400">该学生暂无任何考试成绩记录。</div>;
                    }

                    const fails = studentData.filter(d => d.grade === 'F');
                    const hasFailed = fails.length > 0;
                    
                    return (
                      <div className="p-6">
                        <div className={`mb-6 p-4 rounded-xl border ${hasFailed ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                           <h4 className={`font-bold flex items-center mb-2 ${hasFailed ? 'text-red-700' : 'text-emerald-700'}`}>
                             {hasFailed ? <AlertCircle className="w-5 h-5 mr-2"/> : <CheckCircle className="w-5 h-5 mr-2"/>}
                             {selectedStudent?.chineseName} - 学习进度备注
                           </h4>
                           <p className={`text-sm ${hasFailed ? 'text-red-600' : 'text-emerald-600'}`}>
                             {hasFailed 
                               ? `⚠️ 注意：该生在 【${fails.map(f => f.name).join('、')}】 中总分为不及格 (F等)，请老师多加关注其基础知识掌握情况。` 
                               : `✅ 表现良好：该生在已记录的模拟考中全部及格。`}
                           </p>
                        </div>
                        
                        <div className="h-[400px] w-full mt-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={studentData} margin={{ top: 20, right: 10, bottom: 20, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                              <XAxis dataKey="name" tick={{fontSize: 12, fill: '#78716c'}} axisLine={false} tickLine={false} dy={10} />
                              
                              {/* Left Axis for Total Score (100) */}
                              <YAxis yAxisId="left" domain={[0, 100]} tick={{fontSize: 12, fill: '#059669'}} axisLine={false} tickLine={false} />
                              {/* Right Axis for Parts A-D (15 max usually, setting domain appropriately) */}
                              <YAxis yAxisId="right" orientation="right" domain={[0, 15]} tick={{fontSize: 12, fill: '#78716c'}} axisLine={false} tickLine={false} />
                              
                              <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '12px' }} 
                                labelStyle={{ fontWeight: 'bold', marginBottom: '8px', color: '#1c1917' }}
                              />
                              <Legend wrapperStyle={{ paddingTop: '20px' }} />
                              
                              <Line yAxisId="left" type="monotone" dataKey="total" name="最终得分 (100满分)" stroke="#059669" strokeWidth={3} dot={{ r: 5, strokeWidth: 2 }} activeDot={{ r: 8 }} />
                              <Line yAxisId="right" type="monotone" dataKey="partA" name="A部分 (10满分)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                              <Line yAxisId="right" type="monotone" dataKey="partB" name="B部分 (15满分)" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                              <Line yAxisId="right" type="monotone" dataKey="partC" name="C部分 (10满分)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                              <Line yAxisId="right" type="monotone" dataKey="partD" name="D部分 (15满分)" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        
                        <div className="mt-4 text-xs text-center text-stone-400">
                          * 提示：图表左侧数值轴对应绿色“最终得分 (0-100)”，右侧数值轴对应“A/B/C/D各部分原始分 (0-15)”。
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="p-20 text-center text-stone-400">
                      <div className="bg-stone-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                         <TrendingUp className="w-10 h-10 text-stone-300" /> 
                      </div>
                      <p className="font-medium text-stone-500">请在上方选择班级与学生</p>
                      <p className="text-sm mt-1">系统将生成该学生的历次模拟考多维进展折线图</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {}
            {activeTab === 'class-chart' && (
              <div className="space-y-6 animate-fadeIn">
                 <div className="flex justify-between items-end border-b-2 border-emerald-500 pb-2">
                   <h2 className="text-2xl font-bold text-stone-800">班级深度分析面板</h2>
                   {analysisClass && analysisExamId && (
                     <button onClick={handleExportAnalysisExcel} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center shadow-md hover:bg-blue-700 transition-colors active:scale-95">
                       <Download className="w-4 h-4 mr-2" /> 导出分析报告 (Excel)
                     </button>
                   )}
                 </div>

                 <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                    <div className="p-6 bg-stone-50 border-b border-stone-200 flex flex-wrap gap-6 items-center">
                      <div>
                        <label className="block text-xs font-bold text-stone-500 uppercase mb-2">1. 选择班级</label>
                        <select 
                          value={analysisClass} 
                          onChange={e => setAnalysisClass(e.target.value)} 
                          className="w-48 px-4 py-2.5 border border-stone-300 rounded-xl text-sm bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                        >
                          <option value="">请选择班级...</option>
                          {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-500 uppercase mb-2">2. 选择考试</label>
                        <select 
                          value={analysisExamId} 
                          onChange={e => setAnalysisExamId(e.target.value)} 
                          className="w-56 px-4 py-2.5 border border-stone-300 rounded-xl text-sm bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                        >
                          <option value="">请选择模拟考试...</option>
                          {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </div>
                    </div>

                    {analysisClass && analysisExamId ? (() => {
                      // 聚合数据逻辑，并按照学生英文名A-Z排序
                      const classStudents = students
                        .filter(s => s.class === analysisClass)
                        .sort((a, b) => (a.englishName || '').localeCompare(b.englishName || ''));
                        
                      const classScores = classStudents.map(student => {
                        const score = scores.find(s => s.studentId === student.id && s.examId === analysisExamId);
                        const hasTaken = !!score && (score.partA !== '' || score.partB !== '');
                        const calc = hasTaken ? calculateResult(score.partA, score.partB, score.partC, score.partD) : null;
                        return { student, score, calc, hasTaken };
                      }).filter(item => item.hasTaken);

                      if (classScores.length === 0) {
                        return <div className="p-16 text-center text-stone-400">该班级尚未录入此模拟考的任何成绩。</div>;
                      }

                      const failedItems = classScores.filter(item => item.calc.grade === 'F');
                      const maleFails = failedItems.filter(item => item.student.gender === '男');
                      const femaleFails = failedItems.filter(item => item.student.gender === '女');
                      const excellentItems = classScores.filter(item => item.calc.grade === 'A' || item.calc.grade === 'B');

                      const getPartDist = (key, max) => {
                        let e = 0, p = 0, f = 0;
                        classScores.forEach(item => {
                           const pct = Number(item.score[key] || 0) / max;
                           if (pct >= 0.8) e++; else if (pct >= 0.5) p++; else f++;
                        });
                        return { e, p, f };
                      };
                      const distA = getPartDist('partA', 10);
                      const distB = getPartDist('partB', 15);
                      const distC = getPartDist('partC', 10);
                      const distD = getPartDist('partD', 15);

                      // 生成折线图专用数据
                      const classChartData = classScores.map(item => ({
                        name: item.student.chineseName,
                        total: item.calc.total,
                        isFail: item.calc.grade === 'F'
                      }));

                      return (
                        <div className="p-6 space-y-6">
                          {/* 顶部分析卡片 */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* 不及格统计 */}
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                               <div className="flex items-center text-red-700 mb-4">
                                  <AlertCircle className="w-6 h-6 mr-2" />
                                  <h3 className="text-lg font-bold">不及格人数 (F等)</h3>
                               </div>
                               <div className="flex items-end gap-4 mb-4">
                                  <span className="text-5xl font-black text-red-600">{failedItems.length}</span>
                                  <span className="text-red-700/70 font-medium mb-1">/ {classScores.length} 人</span>
                               </div>
                               <div className="flex gap-4 text-sm font-bold text-red-800 bg-red-100/50 p-3 rounded-xl">
                                  <span>👦 男生: {maleFails.length} 人</span>
                                  <span>👧 女生: {femaleFails.length} 人</span>
                               </div>
                            </div>
                            
                            {/* 优异统计 */}
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                               <div className="flex items-center text-emerald-700 mb-4">
                                  <CheckCircle className="w-6 h-6 mr-2" />
                                  <h3 className="text-lg font-bold">成绩优异 (A或B等)</h3>
                               </div>
                               <div className="flex items-end gap-4 mb-4">
                                  <span className="text-5xl font-black text-emerald-600">{excellentItems.length}</span>
                                  <span className="text-emerald-700/70 font-medium mb-1">/ {classScores.length} 人</span>
                               </div>
                               <div className="text-sm text-emerald-700 font-medium bg-emerald-100/50 p-3 rounded-xl">
                                  干得不错，这部分学生对知识掌握较好。
                               </div>
                            </div>
                          </div>

                          {/* 详细名单区 */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="border border-stone-200 rounded-xl overflow-hidden">
                               <div className="bg-stone-50 px-4 py-3 border-b border-stone-200 font-bold text-stone-700">🚨 需要关注的学生 (不及格)</div>
                               <div className="p-4 max-h-48 overflow-y-auto">
                                 {failedItems.length === 0 ? <p className="text-sm text-stone-400">本班全部及格，太棒了！</p> : (
                                   <div className="flex flex-wrap gap-2">
                                     {failedItems.map(i => (
                                       <span key={i.student.id} className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm bg-red-100 text-red-800 font-medium border border-red-200">
                                         {i.student.chineseName} ({i.calc.total}分)
                                       </span>
                                     ))}
                                   </div>
                                 )}
                               </div>
                             </div>

                             <div className="border border-stone-200 rounded-xl overflow-hidden">
                               <div className="bg-stone-50 px-4 py-3 border-b border-stone-200 font-bold text-stone-700">🌟 成绩优异名单 (A/B等)</div>
                               <div className="p-4 max-h-48 overflow-y-auto">
                                 {excellentItems.length === 0 ? <p className="text-sm text-stone-400">暂无学生达到优异标准。</p> : (
                                   <div className="flex flex-wrap gap-2">
                                     {excellentItems.map(i => (
                                       <span key={i.student.id} className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm bg-emerald-100 text-emerald-800 font-medium border border-emerald-200">
                                         {i.student.chineseName} ({i.calc.total}分)
                                       </span>
                                     ))}
                                   </div>
                                 )}
                               </div>
                             </div>
                          </div>

                          {/* ABCD 各组部分成绩分布表 */}
                          <div className="mt-8 border border-stone-200 rounded-xl overflow-hidden shadow-sm">
                             <div className="bg-stone-800 text-white px-4 py-3 font-bold flex items-center">
                                <BarChart2 className="w-5 h-5 mr-2" />
                                各部分得分分布 (全班概览)
                             </div>
                             <div className="overflow-x-auto">
                               <table className="w-full text-sm text-center border-collapse">
                                 <thead className="bg-stone-100 text-stone-600 border-b border-stone-200">
                                   <tr>
                                     <th className="px-4 py-3 font-bold border-r border-stone-200">试卷结构</th>
                                     <th className="px-4 py-3 font-bold border-r border-stone-200 text-emerald-700">优秀 (得分率 ≥ 80%)</th>
                                     <th className="px-4 py-3 font-bold border-r border-stone-200 text-blue-700">及格 (得分率 50% ~ 79%)</th>
                                     <th className="px-4 py-3 font-bold text-red-600">待加强 (得分率 &lt; 50%)</th>
                                   </tr>
                                 </thead>
                                 <tbody className="divide-y divide-stone-200 text-stone-700 font-medium">
                                   <tr className="hover:bg-stone-50">
                                     <td className="px-4 py-3 border-r border-stone-200 font-bold">A部分 <span className="text-stone-400 text-xs ml-1 font-normal">(满分10)</span></td>
                                     <td className="px-4 py-3 border-r border-stone-200 text-emerald-700">{distA.e} 人</td>
                                     <td className="px-4 py-3 border-r border-stone-200 text-blue-700">{distA.p} 人</td>
                                     <td className="px-4 py-3 text-red-600">{distA.f} 人</td>
                                   </tr>
                                   <tr className="hover:bg-stone-50">
                                     <td className="px-4 py-3 border-r border-stone-200 font-bold">B部分 <span className="text-stone-400 text-xs ml-1 font-normal">(满分15)</span></td>
                                     <td className="px-4 py-3 border-r border-stone-200 text-emerald-700">{distB.e} 人</td>
                                     <td className="px-4 py-3 border-r border-stone-200 text-blue-700">{distB.p} 人</td>
                                     <td className="px-4 py-3 text-red-600">{distB.f} 人</td>
                                   </tr>
                                   <tr className="hover:bg-stone-50">
                                     <td className="px-4 py-3 border-r border-stone-200 font-bold">C部分 <span className="text-stone-400 text-xs ml-1 font-normal">(满分10)</span></td>
                                     <td className="px-4 py-3 border-r border-stone-200 text-emerald-700">{distC.e} 人</td>
                                     <td className="px-4 py-3 border-r border-stone-200 text-blue-700">{distC.p} 人</td>
                                     <td className="px-4 py-3 text-red-600">{distC.f} 人</td>
                                   </tr>
                                   <tr className="hover:bg-stone-50">
                                     <td className="px-4 py-3 border-r border-stone-200 font-bold">D部分 <span className="text-stone-400 text-xs ml-1 font-normal">(满分15)</span></td>
                                     <td className="px-4 py-3 border-r border-stone-200 text-emerald-700">{distD.e} 人</td>
                                     <td className="px-4 py-3 border-r border-stone-200 text-blue-700">{distD.p} 人</td>
                                     <td className="px-4 py-3 text-red-600">{distD.f} 人</td>
                                   </tr>
                                 </tbody>
                               </table>
                             </div>
                          </div>

                          {/* 班级总分线条统计图 */}
                          <div className="mt-8 border border-stone-200 rounded-xl overflow-hidden shadow-sm bg-white p-6">
                             <div className="flex items-center text-stone-800 font-bold mb-6">
                                <TrendingUp className="w-5 h-5 mr-2 text-emerald-600" />
                                班级总分趋势图 (按学生 A-Z 排序)
                             </div>
                             <div className="h-[350px] w-full">
                               <ResponsiveContainer width="100%" height="100%">
                                 <LineChart data={classChartData} margin={{ top: 20, right: 20, left: -20, bottom: 40 }}>
                                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                                   <XAxis dataKey="name" tick={{fontSize: 12, fill: '#78716c'}} axisLine={false} tickLine={false} dy={15} angle={-45} textAnchor="end" />
                                   <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#78716c'}} axisLine={false} tickLine={false} />
                                   <Tooltip 
                                     contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '12px' }} 
                                     labelStyle={{ fontWeight: 'bold', marginBottom: '8px', color: '#1c1917' }}
                                   />
                                   <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: '及格线 (20分)', fill: '#ef4444', fontSize: 12, fontWeight: 'bold' }} />
                                   <Line 
                                     type="monotone" 
                                     dataKey="total" 
                                     name="总分" 
                                     stroke="#cbd5e1" 
                                     strokeWidth={2} 
                                     activeDot={{ r: 8 }}
                                     dot={(props) => {
                                       const { cx, cy, payload } = props;
                                       return (
                                         <circle 
                                           key={`dot-${payload.name}`} 
                                           cx={cx} 
                                           cy={cy} 
                                           r={5} 
                                           fill={payload.isFail ? '#ef4444' : '#10b981'} 
                                           stroke="#fff" 
                                           strokeWidth={2} 
                                         />
                                       );
                                     }} 
                                   />
                                 </LineChart>
                               </ResponsiveContainer>
                             </div>
                             <div className="mt-2 flex justify-center gap-6 text-sm font-medium text-stone-600">
                               <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#10b981] mr-2 shadow-sm"></span> 及格学生</div>
                               <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#ef4444] mr-2 shadow-sm"></span> 不及格学生</div>
                             </div>
                          </div>

                        </div>
                      );
                    })() : (
                      <div className="p-20 text-center text-stone-400">
                        <div className="bg-stone-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                           <BarChart2 className="w-10 h-10 text-stone-300" /> 
                        </div>
                        <p className="font-medium text-stone-500">请在上方选择班级与考试项目</p>
                        <p className="text-sm mt-1">系统将生成详尽的班级测试分析、男女不及格统计以及组别得分分布表。</p>
                      </div>
                    )}
                 </div>
              </div>
            )}

            {}
            {activeTab === 'dashboard' && (
              <div className="space-y-6 animate-fadeIn">
                <h2 className="text-2xl font-bold text-stone-800 border-b-2 border-emerald-500 pb-2 inline-block">系统数据概览</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 flex items-center">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mr-4">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-sm text-stone-500 font-bold mb-1">总学生人数</div>
                      <div className="text-3xl font-black text-stone-800">{students.length}</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mr-4">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-sm text-stone-500 font-bold mb-1">考试项目数</div>
                      <div className="text-3xl font-black text-stone-800">{exams.length}</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 flex items-center">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mr-4">
                      <ClipboardList className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-sm text-stone-500 font-bold mb-1">已录入成绩总数</div>
                      <div className="text-3xl font-black text-stone-800">{scores.length}</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mt-6">
                  <h3 className="font-bold text-lg text-stone-800 mb-4 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-emerald-600"/>
                    班级总体表现对比 (平均分)
                  </h3>
                  {classes.length === 0 || exams.length === 0 ? (
                    <div className="p-10 text-center text-stone-400 bg-stone-50 rounded-xl border border-stone-100">请先录入考试和成绩数据以查看对比图表。</div>
                  ) : (
                    <div className="h-[350px] w-full">
                       <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={getClassChartData('全部')} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                           <XAxis dataKey="name" tick={{fontSize: 12, fill: '#78716c'}} axisLine={false} tickLine={false} dy={10} />
                           <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#78716c'}} axisLine={false} tickLine={false} />
                           <Tooltip 
                             contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '12px' }} 
                             labelStyle={{ fontWeight: 'bold', marginBottom: '8px', color: '#1c1917' }}
                           />
                           <Bar dataKey="平均分" fill="#059669" radius={[6, 6, 0, 0]} maxBarSize={60} />
                         </BarChart>
                       </ResponsiveContainer>
                    </div>
                  )}
                </div>
                
                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mt-6">
                  <h3 className="font-bold text-lg text-stone-800 mb-4">系统操作日志</h3>
                  <div className="h-64 overflow-y-auto pr-2">
                    {logs.length === 0 ? (
                      <div className="text-sm text-stone-400">暂无日志</div>
                    ) : (
                      <div className="space-y-3">
                        {logs.slice(0, 50).map(log => (
                          <div key={log.id} className="text-sm flex flex-col md:flex-row md:justify-between border-b border-stone-100 pb-2">
                            <div>
                              <span className="font-bold text-emerald-700 mr-2">{log.user}</span>
                              <span className="text-stone-600">{log.action}</span>
                            </div>
                            <span className="text-stone-400 text-xs mt-1 md:mt-0">{new Date(log.time).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
              </div>
            )}
            
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center px-4 py-3 rounded-xl transition-all font-bold text-sm text-left ${active ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-800'}`}
    >
      <span className="mr-3">{icon}</span>
      {label}
      {active && <ChevronRight className="w-4 h-4 ml-auto" />}
    </button>
  );
}
