import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  UserCircle, Lock, LogOut, Plus, Trash2, Edit3, Save, X, Search, ChevronRight, BookOpen, Users, BarChart2, CheckCircle, AlertCircle, Leaf, Sprout, ClipboardList
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

// ==========================================
// FIREBASE 配置 (请保留你自己的配置)
// ==========================================
const firebaseConfig = {
    // 你的 Firebase Config
};
const app = Object.keys(firebaseConfig).length > 0 ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
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
  const [user, setUser] = useState(null); 
  const [loginView, setLoginView] = useState('main'); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [scores, setScores] = useState([]);
  const [logs, setLogs] = useState([]);
  
  const [activeTab, setActiveTab] = useState('dashboard'); 
  
  // 基础数据添加表单
  const [studentInputMode, setStudentInputMode] = useState('batch'); 
  const [bulkInput, setBulkInput] = useState('');
  const [newStudent, setNewStudent] = useState({ studentId: '', englishName: '', chineseName: '', gender: '男', class: '' });
  const [newExam, setNewExam] = useState({ name: '' });

  // 成绩批量录入状态
  const [entryClass, setEntryClass] = useState('');
  const [entryExamId, setEntryExamId] = useState('');
  const [draftScores, setDraftScores] = useState({});

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => { await signInAnonymously(auth); };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFbUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!fbUser || !db) return;
    const unsubScores = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'scores'), (snap) => setScores(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubStudents = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'students'), (snap) => setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubExams = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'exams'), (snap) => setExams(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubLogs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), (snap) => {
      const logsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      logsData.sort((a, b) => new Date(b.time) - new Date(a.time));
      setLogs(logsData);
    });
    return () => { unsubScores(); unsubStudents(); unsubExams(); unsubLogs(); };
  }, [fbUser]);

  const addLog = async (action) => {
    const logData = { time: new Date().toISOString(), user: user || 'System', action };
    if (db && fbUser) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'logs', Date.now().toString()), logData);
  };

  // --- 登录逻辑 ---
  const handleTeacherLogin = (e) => { e.preventDefault(); if (username.trim()) { setUser(`教师: ${username}`); addLog('教师登录系统'); setLoginError(''); setUsername(''); } else setLoginError('请输入您的姓名。'); };
  const handleAdminLogin = (e) => { e.preventDefault(); if (password === ADMIN_PASSWORD) { setUser('Admin'); addLog('管理员登录'); setLoginError(''); setPassword(''); setLoginView('main'); } else setLoginError('管理员密码错误。'); };
  const handleSecurityCheck = (e) => { e.preventDefault(); if (securityAnswer.trim() === SECURITY_ANSWER) { alert(`验证成功！请直接登录。`); setLoginView('main'); setSecurityAnswer(''); setLoginError(''); } else setLoginError('回答错误。'); };
  const handleLogout = () => { addLog('退出登录'); setUser(null); setActiveTab('dashboard'); };

  // --- Excel 批量导入学生 ---
  const handleBulkImport = async () => {
    if(!bulkInput.trim()) return alert("请先在文本框中粘贴 Excel 数据！");
    const rows = bulkInput.trim().split('\n');
    let addedCount = 0;
    const batch = (db && fbUser) ? writeBatch(db) : null;
    
    rows.forEach((row, index) => {
      const cols = row.split('\t'); 
      if (cols.length >= 5) {
        const studentData = { studentId: cols[0].trim(), englishName: cols[1].trim(), chineseName: cols[2].trim(), gender: cols[3].trim(), class: cols[4].trim() };
        const id = Date.now().toString() + index; 
        if (batch) batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'students', id), { ...studentData, id });
        addedCount++;
      }
    });
    if (addedCount === 0) return alert("没有读取到有效数据，请检查格式。");
    try {
      if (batch) await batch.commit();
      addLog(`导入了 ${addedCount} 名学生`); setBulkInput(''); alert(`成功导入 ${addedCount} 名学生！`);
    } catch(err) { alert("导入错误。"); }
  };

  const handleAddSingleStudent = async (e) => {
    e.preventDefault();
    const id = Date.now().toString();
    if (db && fbUser) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', id), { ...newStudent, id });
    setNewStudent({ studentId: '', englishName: '', chineseName: '', gender: '男', class: '' });
  };
  const handleDeleteStudent = async (id) => { if(window.confirm('确定删除此学生吗？')) if (db && fbUser) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', id)); };
  const handleAddExam = async (e) => { e.preventDefault(); const id = Date.now().toString(); if (db && fbUser) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'exams', id), { ...newExam, id }); setNewExam({ name: '' }); };
  const handleDeleteExam = async (id) => { if(window.confirm('确定删除吗？')) if (db && fbUser) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'exams', id)); };

  // --- 成绩录入核心逻辑 (表格批量) ---
  
  // 监听班级和考试的选择，提取旧成绩填入表格草稿中
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
          docId: existing ? existing.id : `${s.id}_${entryExamId}` // 使用组合ID防止重复
        };
      });
      setDraftScores(newDrafts);
    } else {
      setDraftScores({});
    }
  }, [entryClass, entryExamId, students, scores]); // 实时同步数据库

  // 记录表格内每次按键输入
  const handleScoreChange = (studentId, field, value) => {
    setDraftScores(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  // 一键保存全班
  const handleSaveBatchScores = async () => {
    const batch = (db && fbUser) ? writeBatch(db) : null;
    let savedCount = 0;

    for (const [studentId, draft] of Object.entries(draftScores)) {
      // 只有填写了分数的才保存
      if (draft.partA !== '' || draft.partB !== '' || draft.partC !== '' || draft.partD !== '') {
        const scoreData = {
          studentId,
          examId: entryExamId,
          partA: Number(draft.partA || 0),
          partB: Number(draft.partB || 0),
          partC: Number(draft.partC || 0),
          partD: Number(draft.partD || 0),
        };
        if (batch) {
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'scores', draft.docId), scoreData);
        }
        savedCount++;
      }
    }
    if (batch) {
      await batch.commit();
      addLog(`批量保存了 ${entryClass} 的成绩`);
      alert(`成功保存了 ${savedCount} 名学生的成绩！`);
    }
  };

  // 辅助计算
  const calculateResult = (partA = 0, partB = 0, partC = 0, partD = 0) => {
    const sum = Number(partA) + Number(partB) + Number(partC) + Number(partD);
    const total = sum * 2;
    const gradeInfo = GRADE_RANGES.find(g => total >= g.min && total <= g.max) || GRADE_RANGES[GRADE_RANGES.length - 1];
    return { sum, total, grade: gradeInfo.grade, status: gradeInfo.status };
  };

  const getStudentChartData = (studentId) => {
    const studentScores = scores.filter(s => s.studentId === studentId);
    return exams.map(exam => {
      const score = studentScores.find(s => s.examId === exam.id);
      return { name: exam.name, '总分': score ? calculateResult(score.partA, score.partB, score.partC, score.partD).total : 0 };
    });
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

  const getPartAnalysisData = (examId, className) => {
     const classStudents = className === '全部' ? students : students.filter(s => s.class === className);
     const studentIds = classStudents.map(s => s.id);
     const relevantScores = scores.filter(s => s.examId === examId && studentIds.includes(s.studentId));
     const isPass = (score, max) => score >= (max * 0.4);
     const analysis = [
       { name: '部分 A (满分 10)', 达标: 0, 未达标: 0 },
       { name: '部分 B (满分 15)', 达标: 0, 未达标: 0 },
       { name: '部分 C (满分 10)', 达标: 0, 未达标: 0 },
       { name: '部分 D (满分 15)', 达标: 0, 未达标: 0 }
     ];
     relevantScores.forEach(score => {
        isPass(score.partA, 10) ? analysis[0].达标++ : analysis[0].未达标++;
        isPass(score.partB, 15) ? analysis[1].达标++ : analysis[1].未达标++;
        isPass(score.partC, 10) ? analysis[2].达标++ : analysis[2].未达标++;
        isPass(score.partD, 15) ? analysis[3].达标++ : analysis[3].未达标++;
     });
     return analysis;
  };

  if (!user) {
    // 登录界面 (缩略)
    return (
      <div className="min-h-screen bg-[#f4f1ea] flex items-center justify-center p-4 font-sans relative overflow-hidden">
        <Leaf className="absolute top-10 left-10 w-32 h-32 text-emerald-600/10 -rotate-45" />
        <Leaf className="absolute bottom-10 right-10 w-48 h-48 text-emerald-600/10 rotate-45" />
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-stone-200 relative z-10">
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-10 text-center">
            <Sprout className="w-16 h-16 text-emerald-100 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white tracking-tight">绿叶模拟考系统</h1>
          </div>
          <div className="p-8 bg-stone-50/50">
            {loginError && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center"><AlertCircle className="w-4 h-4 mr-2" />{loginError}</div>}
            {loginView === 'main' && (
              <form onSubmit={handleTeacherLogin} className="space-y-5">
                <input type="text" className="block w-full px-4 py-3 bg-white border border-stone-300 rounded-xl" placeholder="教师姓名" value={username} onChange={(e) => setUsername(e.target.value)} />
                <button type="submit" className="w-full py-3 px-4 rounded-xl font-bold text-white bg-emerald-600">教师登录</button>
                <button type="button" onClick={() => setLoginView('admin')} className="text-stone-500 font-medium text-sm flex items-center justify-center w-full mt-4"><Lock className="w-3 h-3 mr-1" /> 管理员入口</button>
              </form>
            )}
            {loginView === 'admin' && (
              <form onSubmit={handleAdminLogin} className="space-y-5">
                <input type="password" className="block w-full px-4 py-3 bg-white border border-stone-300 rounded-xl" placeholder="管理员密码" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="submit" className="w-full py-3 px-4 rounded-xl font-bold text-white bg-stone-800">进入后台</button>
                <button type="button" onClick={() => setLoginView('main')} className="w-full py-2 text-sm text-stone-500">返回</button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  const classes = [...new Set(students.map(s => s.class))];
  const isAdmin = user === 'Admin';

  return (
    <div className="min-h-screen bg-[#f4f1ea] font-sans flex text-stone-800">
      <aside className="w-64 bg-white border-r border-stone-200 hidden md:flex flex-col shadow-sm z-10">
        <div className="h-16 flex items-center px-6 bg-emerald-700 text-white">
          <Leaf className="w-6 h-6 mr-2 text-emerald-200" />
          <span className="font-bold text-xl">绿叶系统</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<BarChart2 />} label="系统概览" />
          <NavItem active={activeTab === 'manage-data'} onClick={() => setActiveTab('manage-data')} icon={<BookOpen />} label="1. 基础资料管理" />
          <NavItem active={activeTab === 'data-entry'} onClick={() => setActiveTab('data-entry')} icon={<Edit3 />} label="2. 成绩录入表格" />
          <NavItem active={activeTab === 'student-chart'} onClick={() => setActiveTab('student-chart')} icon={<Users />} label="3. 个人统计(Bar)" />
          <NavItem active={activeTab === 'class-chart'} onClick={() => setActiveTab('class-chart')} icon={<BarChart2 />} label="4. 班级统计(Bar)" />
        </nav>
        <div className="p-4 border-t border-stone-200">
          <button onClick={handleLogout} className="flex items-center w-full px-4 py-2.5 text-sm font-bold text-stone-600 hover:bg-red-50 hover:text-red-600 rounded-xl">
            <LogOut className="w-4 h-4 mr-3" /> 退出登录
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <Leaf className="absolute -bottom-20 -right-20 w-96 h-96 text-emerald-600/5 -rotate-12 pointer-events-none" />
        
        <div className="flex-1 overflow-auto p-6 md:p-8 relative z-10">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* 1. 基础数据管理 */}
            {activeTab === 'manage-data' && (
              <div className="space-y-6 animate-fadeIn">
                 <h2 className="text-2xl font-bold text-stone-800 border-b-2 border-emerald-500 pb-2 inline-block">第一步: 输入试卷与学生资料</h2>
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 考试管理 */}
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 flex flex-col h-full">
                      <h3 className="font-bold text-lg text-amber-800 mb-4 flex items-center"><BookOpen className="w-5 h-5 mr-2"/>1. 考试项目管理</h3>
                      <form onSubmit={handleAddExam} className="flex gap-2 mb-6">
                        <input required type="text" placeholder="考试名称 (如 模拟考3)" className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm" value={newExam.name} onChange={e => setNewExam({name: e.target.value})} />
                        <button type="submit" className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-amber-700">添加</button>
                      </form>
                      <div className="flex-1 overflow-y-auto border border-stone-100 rounded-xl">
                        {exams.map(e => (
                          <div key={e.id} className="flex justify-between items-center p-3 border-b border-stone-100 hover:bg-stone-50">
                            <div className="text-sm font-bold text-stone-700">{e.name}</div>
                            <button onClick={() => handleDeleteExam(e.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* 学生管理 */}
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 flex flex-col h-full">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-emerald-800 flex items-center"><Users className="w-5 h-5 mr-2"/>2. 学生资料录入</h3>
                        <div className="flex bg-stone-100 rounded-lg p-1">
                          <button onClick={() => setStudentInputMode('batch')} className={`px-3 py-1.5 text-xs font-bold rounded-md ${studentInputMode === 'batch' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500'}`}>Excel 粘贴</button>
                          <button onClick={() => setStudentInputMode('single')} className={`px-3 py-1.5 text-xs font-bold rounded-md ${studentInputMode === 'single' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500'}`}>手动录入</button>
                        </div>
                      </div>
                      {studentInputMode === 'batch' ? (
                        <div className="mb-6">
                          <p className="text-xs text-stone-500 mb-2">复制5列：<span className="font-mono bg-stone-100 px-1">学号|英文名|中文名|性别|班级</span></p>
                          <textarea value={bulkInput} onChange={(e) => setBulkInput(e.target.value)} className="w-full h-32 p-3 text-xs border border-stone-300 rounded-xl mb-2 font-mono" placeholder="1001&#9;Ali&#9;阿里&#9;男&#9;5A" />
                          <button onClick={handleBulkImport} className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex justify-center items-center"><ClipboardList className="w-4 h-4 mr-2" /> 确认批量导入</button>
                        </div>
                      ) : (
                        <form onSubmit={handleAddSingleStudent} className="mb-6 space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <input required type="text" placeholder="学号" className="px-3 py-2 border border-stone-300 rounded-lg text-sm" value={newStudent.studentId} onChange={e => setNewStudent({...newStudent, studentId: e.target.value})} />
                            <input required type="text" placeholder="班级 (如 5A)" className="px-3 py-2 border border-stone-300 rounded-lg text-sm" value={newStudent.class} onChange={e => setNewStudent({...newStudent, class: e.target.value})} />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input required type="text" placeholder="中文名字" className="px-3 py-2 border border-stone-300 rounded-lg text-sm" value={newStudent.chineseName} onChange={e => setNewStudent({...newStudent, chineseName: e.target.value})} />
                            <input required type="text" placeholder="英文名字" className="px-3 py-2 border border-stone-300 rounded-lg text-sm" value={newStudent.englishName} onChange={e => setNewStudent({...newStudent, englishName: e.target.value})} />
                          </div>
                          <div className="flex gap-2">
                            <select className="px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white w-24" value={newStudent.gender} onChange={e => setNewStudent({...newStudent, gender: e.target.value})}><option>男</option><option>女</option></select>
                            <button type="submit" className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold">单人添加</button>
                          </div>
                        </form>
                      )}
                      <div className="flex-1 max-h-48 overflow-y-auto border border-stone-100 rounded-xl">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-stone-50 sticky top-0 text-stone-500"><tr><th className="px-3 py-2">学号</th><th className="px-3 py-2">中文名(班级)</th><th className="px-3 py-2 text-right">操作</th></tr></thead>
                          <tbody className="divide-y divide-stone-100">
                            {students.map(s => (
                              <tr key={s.id} className="hover:bg-stone-50">
                                <td className="px-3 py-2 font-mono text-stone-500">{s.studentId}</td>
                                <td className="px-3 py-2 font-bold text-stone-700">{s.chineseName} ({s.class})</td>
                                <td className="px-3 py-2 text-right"><button onClick={() => handleDeleteStudent(s.id)} className="text-red-500 p-1.5"><Trash2 className="w-4 h-4"/></button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                 </div>
              </div>
            )}

            {/* 2. 成绩录入智能表格 */}
            {activeTab === 'data-entry' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex justify-between items-end border-b-2 border-emerald-500 pb-2">
                  <h2 className="text-2xl font-bold text-stone-800">第二步: 智能录入表格</h2>
                  {entryClass && entryExamId && (
                    <button onClick={handleSaveBatchScores} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center shadow-md hover:bg-emerald-700 transition-colors transform hover:-translate-y-0.5">
                      <Save className="w-4 h-4 mr-2" /> 一键保存全班成绩
                    </button>
                  )}
                </div>
                
                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                  <div className="p-6 bg-stone-50 border-b border-stone-200 flex flex-wrap gap-4 items-center">
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase mb-1">1. 选择班级</label>
                      <select value={entryClass} onChange={e => setEntryClass(e.target.value)} className="w-48 px-3 py-2 border border-stone-300 rounded-xl text-sm bg-white font-medium focus:ring-2 focus:ring-emerald-500">
                        <option value="">请选择班级...</option>
                        {classes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase mb-1">2. 选择考试</label>
                      <select value={entryExamId} onChange={e => setEntryExamId(e.target.value)} className="w-56 px-3 py-2 border border-stone-300 rounded-xl text-sm bg-white font-medium focus:ring-2 focus:ring-emerald-500">
                        <option value="">请选择模拟考试...</option>
                        {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </div>
                    {entryClass && entryExamId && (
                       <div className="ml-auto text-sm text-stone-500 bg-amber-50 px-4 py-2 rounded-lg border border-amber-100 flex items-center">
                         <AlertCircle className="w-4 h-4 text-amber-500 mr-2" />
                         输入完毕后，请务必点击右上角的“一键保存”
                       </div>
                    )}
                  </div>

                  {entryClass && entryExamId ? (
                    <div className="overflow-x-auto max-h-[60vh]">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-emerald-700 text-white sticky top-0 z-10 shadow-sm">
                          <tr>
                            <th className="px-4 py-3 font-bold border-r border-emerald-600">学号</th>
                            <th className="px-4 py-3 font-bold border-r border-emerald-600">姓名</th>
                            <th className="px-2 py-3 font-bold text-center border-r border-emerald-600 w-24">A (10分)</th>
                            <th className="px-2 py-3 font-bold text-center border-r border-emerald-600 w-24">B (15分)</th>
                            <th className="px-2 py-3 font-bold text-center border-r border-emerald-600 w-24">C (10分)</th>
                            <th className="px-2 py-3 font-bold text-center border-r border-emerald-600 w-24">D (15分)</th>
                            <th className="px-4 py-3 font-bold text-center bg-emerald-800">卷面分(50)</th>
                            <th className="px-4 py-3 font-bold text-center bg-emerald-900">总分(100)</th>
                            <th className="px-4 py-3 font-bold text-center bg-emerald-900">等级</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200">
                          {students.filter(s => s.class === entryClass).map((student, idx) => {
                            const draft = draftScores[student.id] || {};
                            const calc = calculateResult(draft.partA, draft.partB, draft.partC, draft.partD);
                            const hasInput = draft.partA !== '' || draft.partB !== '' || draft.partC !== '' || draft.partD !== '';
                            
                            return (
                              <tr key={student.id} className={`hover:bg-emerald-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-stone-50'}`}>
                                <td className="px-4 py-3 font-mono text-stone-500 border-r border-stone-200">{student.studentId}</td>
                                <td className="px-4 py-3 font-bold text-stone-800 border-r border-stone-200">{student.chineseName}</td>
                                
                                {/* 4个输入框 */}
                                <td className="px-2 py-2 border-r border-stone-200">
                                  <input type="number" min="0" max="10" placeholder="-" className="w-full px-2 py-1.5 text-center border border-stone-300 rounded bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium" value={draft.partA || ''} onChange={e => handleScoreChange(student.id, 'partA', e.target.value)} />
                                </td>
                                <td className="px-2 py-2 border-r border-stone-200">
                                  <input type="number" min="0" max="15" placeholder="-" className="w-full px-2 py-1.5 text-center border border-stone-300 rounded bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium" value={draft.partB || ''} onChange={e => handleScoreChange(student.id, 'partB', e.target.value)} />
                                </td>
                                <td className="px-2 py-2 border-r border-stone-200">
                                  <input type="number" min="0" max="10" placeholder="-" className="w-full px-2 py-1.5 text-center border border-stone-300 rounded bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium" value={draft.partC || ''} onChange={e => handleScoreChange(student.id, 'partC', e.target.value)} />
                                </td>
                                <td className="px-2 py-2 border-r border-stone-200">
                                  <input type="number" min="0" max="15" placeholder="-" className="w-full px-2 py-1.5 text-center border border-stone-300 rounded bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium" value={draft.partD || ''} onChange={e => handleScoreChange(student.id, 'partD', e.target.value)} />
                                </td>

                                {/* 自动计算结果展示 */}
                                <td className="px-4 py-3 text-center text-stone-600 font-bold bg-stone-100/50">{hasInput ? calc.sum : '-'}</td>
                                <td className="px-4 py-3 text-center text-emerald-700 font-extrabold text-lg bg-emerald-50/50">{hasInput ? calc.total : '-'}</td>
                                <td className="px-4 py-3 text-center bg-emerald-50/50">
                                  {hasInput ? (
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${calc.grade === 'F' ? 'bg-red-100 text-red-700' : 'bg-emerald-200 text-emerald-800'}`}>
                                      {calc.grade}
                                    </span>
                                  ) : '-'}
                                </td>
                              </tr>
                            );
                          })}
                          {students.filter(s => s.class === entryClass).length === 0 && (
                            <tr><td colSpan="9" className="text-center py-10 text-stone-400">该班级尚未录入学生名单。</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-16 text-center text-stone-400">
                      <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      请在上方选择班级和考试，即可显示批量录入表格。
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 图表及其他保持不变 (缩略) */}
            {activeTab === 'student-chart' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-stone-800 border-b-2 border-emerald-500 pb-2 inline-block">学生个人成绩条形图</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {students.map(student => {
                    const data = getStudentChartData(student.id);
                    if (!data.some(d => d['总分'] > 0)) return null;
                    return (
                      <div key={student.id} className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
                        <h3 className="font-bold text-stone-800 mb-4">{student.chineseName} ({student.class})</h3>
                        <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" /><XAxis dataKey="name" tick={{fontSize: 12, fill: '#78716c'}} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#78716c'}} axisLine={false} tickLine={false} /><Tooltip cursor={{fill: '#f5f5f4'}} contentStyle={{ borderRadius: '12px' }} /><Bar dataKey="总分" fill="#059669" radius={[4, 4, 0, 0]} barSize={40} /></BarChart></ResponsiveContainer></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {activeTab === 'dashboard' && (
              <div className="space-y-6 animate-fadeIn">
                <h2 className="text-2xl font-bold text-stone-800 border-b-2 border-emerald-500 pb-2 inline-block">欢迎使用绿叶系统</h2>
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 text-center"><Leaf className="w-16 h-16 text-emerald-500 mx-auto mb-4" /><p className="text-stone-600 text-lg">请点击左侧菜单开始使用。</p></div>
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
    <button onClick={onClick} className={`w-full flex items-center px-4 py-3.5 rounded-xl font-bold transition-all ${ active ? 'bg-emerald-600 text-white shadow-md' : 'text-stone-500 hover:bg-stone-100' }`}><span className={`mr-3 ${active ? 'text-white' : 'text-stone-400'}`}>{icon}</span>{label}</button>
  );
}
