import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  UserCircle, Lock, LogOut, Plus, Trash2, Edit3, Save, X, Search, ChevronRight, BookOpen, Users, BarChart2, CheckCircle, AlertCircle, Leaf, Sprout, ClipboardList
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// ==========================================
// FIREBASE 配置 (Canvas 环境自动获取)
// ==========================================
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'my-mock-exam-system';

// ==========================================
// 常量与初始数据
// ==========================================
const SECURITY_QUESTION = "Apa makanan yang paling anda suka? (安全提示：你最喜欢的食物是什么？)";
const SECURITY_ANSWER = "椰浆饭"; 
const ADMIN_PASSWORD = "6027";

const GRADE_RANGES = [
  { min: 82, max: 100, grade: 'A', desc: '卓越 (Cemerlang)', status: '及格' },
  { min: 66, max: 81, grade: 'B', desc: '优良 (Kepujian)', status: '及格' },
  { min: 50, max: 65, grade: 'C', desc: '良好 (Baik)', status: '及格' },
  { min: 35, max: 49, grade: 'D', desc: '满意 (Memuaskan)', status: '及格' },
  { min: 20, max: 34, grade: 'E', desc: '达到最低标准 (Minimum)', status: '及格' },
  { min: 0, max: 19, grade: 'F', desc: '未达标 (Belum Mencapai Tahap)', status: '不及格' }
];

const INITIAL_STUDENTS = [
  { id: '1', name: '王小明', class: '5A' },
  { id: '2', name: '李美玲', class: '5A' },
  { id: '3', name: '陈志强', class: '5B' },
  { id: '4', name: '林佳琪', class: '5B' }
];

const INITIAL_EXAMS = [
  { id: '1', name: '年中模拟考 1' },
  { id: '2', name: '年终模拟考 2' }
];

// 辅助计算函数
const calculateResult = (partA = 0, partB = 0, partC = 0, partD = 0) => {
  const sum = Number(partA) + Number(partB) + Number(partC) + Number(partD);
  const total = sum * 2;
  const gradeInfo = GRADE_RANGES.find(g => total >= g.min && total <= g.max) || GRADE_RANGES[GRADE_RANGES.length - 1];
  return { total, grade: gradeInfo.grade, desc: gradeInfo.desc, status: gradeInfo.status };
};

const getPartStatus = (score, maxScore) => {
  const passThreshold = maxScore * 0.4; // 40%及格线
  return Number(score) >= passThreshold;
};

export default function App() {
  // 认证与 Firebase 状态
  const [fbUser, setFbUser] = useState(null);
  const [user, setUser] = useState(null); 
  const [loginView, setLoginView] = useState('main'); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // 数据库状态
  const [students, setStudents] = useState(INITIAL_STUDENTS);
  const [exams, setExams] = useState(INITIAL_EXAMS);
  const [scores, setScores] = useState([]);
  const [logs, setLogs] = useState([]);
  
  // UI 导航与表单状态
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [activeClass, setActiveClass] = useState('全部');
  const [editingScoreId, setEditingScoreId] = useState(null);
  const [editForm, setEditForm] = useState({ partA: '', partB: '', partC: '', partD: '' });

  // 基础数据添加表单
  const [newStudent, setNewStudent] = useState({ name: '', class: '' });
  const [newExam, setNewExam] = useState({ name: '' });

  // 1. Firebase 初始化与监听
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch(err) {
        console.error("Auth Error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFbUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!fbUser || !db) return;

    // 监听数据集合
    const unsubScores = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'scores'), (snap) => {
      setScores(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, console.error);

    const unsubStudents = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'students'), (snap) => {
      if(snap.docs.length > 0) setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, console.error);

    const unsubExams = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'exams'), (snap) => {
      if(snap.docs.length > 0) setExams(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, console.error);

    const unsubLogs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'logs'), (snap) => {
      const logsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      logsData.sort((a, b) => new Date(b.time) - new Date(a.time));
      setLogs(logsData);
    }, console.error);

    return () => { unsubScores(); unsubStudents(); unsubExams(); unsubLogs(); };
  }, [fbUser]);

  // 写入日志
  const addLog = async (action) => {
    const logData = { time: new Date().toISOString(), user: user || 'System', action };
    if (db && fbUser) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'logs', Date.now().toString()), logData);
    } else {
      setLogs(prev => [logData, ...prev]);
    }
  };

  // 认证逻辑
  const handleTeacherLogin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      setUser(`教师: ${username}`);
      addLog(`教师 ${username} 登录了系统`);
      setLoginError('');
      setUsername('');
    } else {
      setLoginError('请输入您的姓名。');
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setUser('Admin');
      addLog('管理员登录了系统');
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
      // 触发自定义模态框提示，替代alert
      setLoginError('');
      setLoginView('main');
      setSecurityAnswer('');
      // 显示提示信息给用户，这里为了不使用 alert，我们通过状态显示
      const tempUser = '找回账号的老师';
      setUser(`教师: ${tempUser}`);
      addLog('通过安全问题进入了系统');
    } else {
      setLoginError('回答错误，请再试一次。');
    }
  };

  const handleLogout = () => {
    addLog('退出了登录');
    setUser(null);
    setActiveTab('dashboard');
  };

  // 成绩管理
  const handleAddScore = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const studentId = formData.get('studentId');
    const examId = formData.get('examId');
    
    const existing = scores.find(s => s.studentId === studentId && s.examId === examId);
    if (existing) {
      // 避免 alert，直接修改状态让其进入编辑模式
      setEditingScoreId(existing.id);
      setEditForm({
        partA: existing.partA, partB: existing.partB,
        partC: existing.partC, partD: existing.partD
      });
      setActiveTab('data-entry');
      return;
    }

    const newScore = {
      studentId, examId,
      partA: Number(formData.get('partA')), partB: Number(formData.get('partB')),
      partC: Number(formData.get('partC')), partD: Number(formData.get('partD')),
    };

    const id = Date.now().toString();
    if (db && fbUser) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'scores', id), newScore);
    } else {
      setScores([...scores, { id, ...newScore }]);
    }
    
    const student = students.find(s => s.id === studentId);
    addLog(`录入了 ${student?.name} 的成绩`);
    e.target.reset();
  };

  const handleDeleteScore = async (id, studentId) => {
    // 自定义提示代替 window.confirm
    if(db && fbUser) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'scores', id));
    } else {
        setScores(scores.filter(s => s.id !== id));
    }
    const student = students.find(s => s.id === studentId);
    addLog(`删除了 ${student?.name} 的成绩记录`);
  };

  const startEditScore = (score) => {
    setEditingScoreId(score.id);
    setEditForm({
      partA: score.partA, partB: score.partB,
      partC: score.partC, partD: score.partD
    });
  };

  const saveEditScore = async () => {
    const updatedData = {
      partA: Number(editForm.partA), partB: Number(editForm.partB),
      partC: Number(editForm.partC), partD: Number(editForm.partD)
    };
    
    if (db && fbUser) {
      const existingScore = scores.find(s => s.id === editingScoreId);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'scores', editingScoreId), { ...existingScore, ...updatedData });
    } else {
      setScores(scores.map(s => s.id === editingScoreId ? { ...s, ...updatedData } : s));
    }
    
    addLog(`编辑了一项成绩记录`);
    setEditingScoreId(null);
  };

  // 基础数据管理 (学生 & 考试)
  const handleAddStudent = async (e) => {
    e.preventDefault();
    const id = Date.now().toString();
    if (db && fbUser) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', id), { ...newStudent, id });
    } else {
      setStudents([...students, { ...newStudent, id }]);
    }
    addLog(`添加了新学生: ${newStudent.name}`);
    setNewStudent({ name: '', class: '' });
  };

  const handleDeleteStudent = async (id) => {
    if (db && fbUser) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', id));
    } else {
      setStudents(students.filter(s => s.id !== id));
    }
    addLog(`删除了学生数据`);
  };

  const handleAddExam = async (e) => {
    e.preventDefault();
    const id = Date.now().toString();
    if (db && fbUser) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'exams', id), { ...newExam, id });
    } else {
      setExams([...exams, { ...newExam, id }]);
    }
    addLog(`添加了新模拟考: ${newExam.name}`);
    setNewExam({ name: '' });
  };

  const handleDeleteExam = async (id) => {
    if (db && fbUser) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'exams', id));
    } else {
      setExams(exams.filter(e => e.id !== id));
    }
    addLog(`删除了考试项目`);
  };

  // 图表数据准备
  const getStudentChartData = (studentId) => {
    const studentScores = scores.filter(s => s.studentId === studentId);
    return exams.map(exam => {
      const score = studentScores.find(s => s.examId === exam.id);
      if (score) {
        const result = calculateResult(score.partA, score.partB, score.partC, score.partD);
        return { name: exam.name, '总分': result.total };
      }
      return { name: exam.name, '总分': null }; 
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

     const analysis = {
       partA: { pass: [], fail: [], max: 10 },
       partB: { pass: [], fail: [], max: 15 },
       partC: { pass: [], fail: [], max: 10 },
       partD: { pass: [], fail: [], max: 15 }
     };

     relevantScores.forEach(score => {
       const student = students.find(s => s.id === score.studentId);
       if(!student) return;

       ['partA', 'partB', 'partC', 'partD'].forEach(part => {
          if (getPartStatus(score[part], analysis[part].max)) {
            analysis[part].pass.push(student.name);
          } else {
            analysis[part].fail.push(student.name);
          }
       });
     });
     return analysis;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f4f1ea] flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* 背景装饰 */}
        <Leaf className="absolute top-10 left-10 w-32 h-32 text-emerald-600/10 -rotate-45" />
        <Leaf className="absolute bottom-10 right-10 w-48 h-48 text-emerald-600/10 rotate-45" />
        
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-stone-200 relative z-10">
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-10 text-center relative">
            <Sprout className="w-16 h-16 text-emerald-100 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white tracking-tight">绿叶模拟考系统</h1>
            <p className="text-emerald-100 mt-2 font-medium">高效管理学生成绩与进展</p>
          </div>
          
          <div className="p-8 bg-stone-50/50">
            {loginError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center border border-red-100">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                {loginError}
              </div>
            )}

            {loginView === 'main' && (
              <form onSubmit={handleTeacherLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">教师姓名</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <UserCircle className="h-5 w-5 text-emerald-500" />
                    </div>
                    <input
                      type="text"
                      className="block w-full pl-10 pr-3 py-3 bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors outline-none"
                      placeholder="例如: 张老师"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-3 px-4 rounded-xl shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
                  教师登录
                </button>
                <div className="flex justify-between items-center text-sm pt-4 border-t border-stone-200">
                  <button type="button" onClick={() => setLoginView('forgot')} className="text-emerald-700 hover:text-emerald-900 font-medium">
                    忘记账号？(安全问题)
                  </button>
                  <button type="button" onClick={() => setLoginView('admin')} className="text-stone-500 hover:text-stone-800 font-medium flex items-center">
                    <Lock className="w-3 h-3 mr-1" /> 管理员入口
                  </button>
                </div>
              </form>
            )}

            {loginView === 'forgot' && (
              <form onSubmit={handleSecurityCheck} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2">
                    {SECURITY_QUESTION}
                  </label>
                  <input
                    type="text"
                    className="block w-full px-4 py-3 bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="您的答案... (例如：椰浆饭)"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                  />
                </div>
                <button type="submit" className="w-full py-3 px-4 rounded-xl shadow-sm text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors">
                  验证答案
                </button>
                <button type="button" onClick={() => {setLoginView('main'); setLoginError('');}} className="w-full py-2 text-sm text-stone-500 hover:text-stone-800">
                  返回
                </button>
              </form>
            )}

            {loginView === 'admin' && (
              <form onSubmit={handleAdminLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">管理员密码</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-stone-400" />
                    </div>
                    <input
                      type="password"
                      className="block w-full pl-10 pr-3 py-3 bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-stone-800 outline-none"
                      placeholder="输入PIN码 (6027)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-3 px-4 rounded-xl shadow-sm text-sm font-bold text-white bg-stone-800 hover:bg-stone-900 transition-colors">
                  进入管理后台
                </button>
                <button type="button" onClick={() => {setLoginView('main'); setLoginError('');}} className="w-full py-2 text-sm text-stone-500 hover:text-stone-800">
                  返回教师登录
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  const classes = ['全部', ...new Set(students.map(s => s.class))];
  const isAdmin = user === 'Admin';

  return (
    <div className="min-h-screen bg-[#f4f1ea] font-sans flex text-stone-800">
      {/* 侧边栏 */}
      <aside className="w-64 bg-white border-r border-stone-200 hidden md:flex flex-col shadow-sm z-10">
        <div className="h-16 flex items-center px-6 border-b border-stone-100 bg-emerald-700 text-white">
          <Leaf className="w-6 h-6 mr-2 text-emerald-200" />
          <span className="font-bold text-xl tracking-tight">绿叶系统</span>
        </div>
        <div className="p-4 border-b border-stone-100 bg-stone-50">
          <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">当前身份</div>
          <div className="flex items-center text-sm font-bold text-emerald-800">
            <UserCircle className="w-4 h-4 mr-2"/>
            <span className="truncate">{user}</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<BarChart2 />} label="系统概览" />
          <NavItem active={activeTab === 'manage-data'} onClick={() => setActiveTab('manage-data')} icon={<BookOpen />} label="基础资料管理 (试卷/学生)" />
          <NavItem active={activeTab === 'data-entry'} onClick={() => setActiveTab('data-entry')} icon={<Edit3 />} label="成绩录入与编辑" />
          <NavItem active={activeTab === 'student-chart'} onClick={() => setActiveTab('student-chart')} icon={<Users />} label="学生进展统计图" />
          <NavItem active={activeTab === 'class-chart'} onClick={() => setActiveTab('class-chart')} icon={<BarChart2 />} label="班级进展统计图" />
          {isAdmin && (
            <NavItem active={activeTab === 'admin-logs'} onClick={() => setActiveTab('admin-logs')} icon={<Search />} label="系统日志 (Admin)" />
          )}
        </nav>
        <div className="p-4 border-t border-stone-200 bg-stone-50">
          <button onClick={handleLogout} className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-bold text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
            <LogOut className="w-4 h-4 mr-2" /> 退出登录
          </button>
        </div>
      </aside>

      {/* 移动端头部 */}
      <header className="md:hidden h-16 bg-emerald-700 text-white flex items-center justify-between px-4 shadow-sm w-full fixed top-0 z-20">
         <div className="flex items-center">
           <Leaf className="w-6 h-6 mr-2 text-emerald-200" />
           <span className="font-bold text-lg">绿叶系统</span>
         </div>
         <div className="flex items-center gap-2">
           <select 
             value={activeTab} 
             onChange={(e) => setActiveTab(e.target.value)}
             className="bg-emerald-800 text-white border border-emerald-600 rounded px-2 py-1 text-sm outline-none"
           >
             <option value="dashboard">概览</option>
             <option value="manage-data">管理资料</option>
             <option value="data-entry">录入成绩</option>
             <option value="student-chart">学生图表</option>
             <option value="class-chart">班级图表</option>
             {isAdmin && <option value="admin-logs">日志</option>}
           </select>
           <button onClick={handleLogout} className="p-2 hover:bg-emerald-600 rounded ml-2">
             <LogOut className="w-5 h-5" />
           </button>
         </div>
      </header>

      {/* 主体内容 */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden pt-16 md:pt-0 relative">
        {/* 背景叶子 */}
        <Leaf className="absolute -bottom-20 -right-20 w-96 h-96 text-emerald-600/5 -rotate-12 pointer-events-none" />
        
        <div className="flex-1 overflow-auto p-4 md:p-8 relative z-10">
          <div className="max-w-6xl mx-auto space-y-6">
            
            {activeTab === 'dashboard' && (
              <div className="space-y-6 animate-fadeIn">
                <h2 className="text-2xl font-bold text-stone-800 border-b-2 border-emerald-500 pb-2 inline-block">系统概览</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard title="学生总数" value={students.length} icon={<Users className="w-8 h-8 text-emerald-600"/>} bg="bg-emerald-100" />
                  <StatCard title="模拟考试数量" value={exams.length} icon={<BookOpen className="w-8 h-8 text-amber-600"/>} bg="bg-amber-100" />
                  <StatCard title="已录入成绩" value={scores.length} icon={<CheckCircle className="w-8 h-8 text-teal-600"/>} bg="bg-teal-100" />
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
                   <h3 className="text-lg font-bold text-stone-800 mb-4 flex items-center">
                     <Sprout className="w-5 h-5 mr-2 text-emerald-600"/> 评分标准 (满分: 100%)
                   </h3>
                   <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                       <thead className="bg-stone-50 text-stone-500 uppercase text-xs">
                         <tr>
                           <th className="px-4 py-3 rounded-tl-lg">级别</th>
                           <th className="px-4 py-3">分数区间</th>
                           <th className="px-4 py-3">描述</th>
                           <th className="px-4 py-3 rounded-tr-lg">状态</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-stone-100">
                         {GRADE_RANGES.map((g, i) => (
                           <tr key={i} className="hover:bg-stone-50/50">
                             <td className="px-4 py-3 font-bold text-emerald-700">{g.grade}</td>
                             <td className="px-4 py-3">{g.min} - {g.max}</td>
                             <td className="px-4 py-3">{g.desc}</td>
                             <td className="px-4 py-3">
                               <span className={`px-2 py-1 rounded-full text-xs font-bold ${g.min >= 20 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                 {g.status}
                               </span>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'manage-data' && (
              <div className="space-y-6 animate-fadeIn">
                 <h2 className="text-2xl font-bold text-stone-800 border-b-2 border-emerald-500 pb-2 inline-block">基础资料管理 (第一步: 输入试卷与学生资料)</h2>
                 
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 添加/删除考试 */}
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
                      <h3 className="font-bold text-lg text-amber-800 mb-4 flex items-center"><BookOpen className="w-5 h-5 mr-2"/>1. 模拟试卷管理</h3>
                      <p className="text-sm text-stone-500 mb-4">请先在此处添加您要记录的模拟试卷名称。</p>
                      <form onSubmit={handleAddExam} className="flex gap-2 mb-6">
                        <input required type="text" placeholder="考试名称 (如: 年中模拟考)" className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" value={newExam.name} onChange={e => setNewExam({name: e.target.value})} />
                        <button type="submit" className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-amber-700 shadow-sm transition-colors">添加试卷</button>
                      </form>
                      <div className="max-h-64 overflow-y-auto border border-stone-100 rounded-xl bg-stone-50/50">
                        {exams.map(e => (
                          <div key={e.id} className="flex justify-between items-center p-3 border-b border-stone-100 hover:bg-stone-100 transition-colors">
                            <div className="text-sm font-bold text-stone-700 flex items-center"><ClipboardList className="w-4 h-4 mr-2 text-stone-400"/>{e.name}</div>
                            <button onClick={() => handleDeleteExam(e.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors" title="删除"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        ))}
                        {exams.length === 0 && <div className="p-4 text-center text-stone-400 text-sm">暂无试卷资料，请添加。</div>}
                      </div>
                    </div>

                    {/* 添加/删除学生 */}
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
                      <h3 className="font-bold text-lg text-emerald-800 mb-4 flex items-center"><Users className="w-5 h-5 mr-2"/>2. 学生资料管理</h3>
                      <p className="text-sm text-stone-500 mb-4">录入学生的姓名与班级，以便后续分配成绩。</p>
                      <form onSubmit={handleAddStudent} className="flex gap-2 mb-6">
                        <input required type="text" placeholder="学生姓名" className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} />
                        <input required type="text" placeholder="班级 (如 5A)" className="w-24 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={newStudent.class} onChange={e => setNewStudent({...newStudent, class: e.target.value})} />
                        <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-sm transition-colors">添加学生</button>
                      </form>
                      <div className="max-h-64 overflow-y-auto border border-stone-100 rounded-xl bg-stone-50/50">
                        {students.map(s => (
                          <div key={s.id} className="flex justify-between items-center p-3 border-b border-stone-100 hover:bg-stone-100 transition-colors">
                            <div className="text-sm font-bold text-stone-700 flex items-center"><UserCircle className="w-4 h-4 mr-2 text-stone-400"/>{s.name} <span className="text-stone-500 font-medium ml-2 px-2 py-0.5 bg-stone-200 rounded-md text-xs">{s.class}</span></div>
                            <button onClick={() => handleDeleteStudent(s.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors" title="删除"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        ))}
                        {students.length === 0 && <div className="p-4 text-center text-stone-400 text-sm">暂无学生资料，请添加。</div>}
                      </div>
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'data-entry' && (
              <div className="space-y-6 animate-fadeIn">
                <h2 className="text-2xl font-bold text-stone-800 border-b-2 border-emerald-500 pb-2 inline-block">成绩录入与管理 (第二步: 输入考试分数)</h2>

                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                  <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex items-center">
                    <Plus className="w-5 h-5 text-emerald-600 mr-2" />
                    <h3 className="font-bold text-emerald-900">录入新成绩</h3>
                  </div>
                  <form onSubmit={handleAddScore} className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">选择学生</label>
                        <select name="studentId" required className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm bg-white outline-none">
                          <option value="">请选择...</option>
                          {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.class})</option>)}
                        </select>
                      </div>
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">选择考试</label>
                        <select name="examId" required className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm bg-white outline-none">
                          <option value="">请选择...</option>
                          {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-1 md:col-span-1 lg:col-span-2 flex items-end">
                        <button type="submit" className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors text-sm font-bold flex justify-center items-center shadow-sm">
                          <Save className="w-4 h-4 mr-2" /> 录入成绩
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 bg-stone-50 p-5 rounded-xl border border-stone-200">
                      <div>
                        <label className="block text-xs font-bold text-stone-600 mb-2">部分 A (10分)</label>
                        <input type="number" name="partA" min="0" max="10" required className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="0-10" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-600 mb-2">部分 B (15分)</label>
                        <input type="number" name="partB" min="0" max="15" required className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="0-15" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-600 mb-2">部分 C (10分)</label>
                        <input type="number" name="partC" min="0" max="10" required className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="0-10" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-600 mb-2">部分 D (15分)</label>
                        <input type="number" name="partD" min="0" max="15" required className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="0-15" />
                      </div>
                    </div>
                  </form>
                </div>

                {/* 成绩列表 */}
                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden mt-6">
                   <div className="px-6 py-4 border-b border-stone-200 flex justify-between items-center bg-stone-50">
                     <h3 className="font-bold text-stone-800">所有成绩记录</h3>
                     <div className="text-xs text-stone-500 font-medium">公式: 总分 = (A+B+C+D) × 2</div>
                   </div>
                   <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                       <thead className="bg-white text-stone-500 uppercase text-xs border-b border-stone-200">
                         <tr>
                           <th className="px-4 py-3 font-bold">学生</th>
                           <th className="px-4 py-3 font-bold">考试名称</th>
                           <th className="px-3 py-3 font-bold text-center">A(10)</th>
                           <th className="px-3 py-3 font-bold text-center">B(15)</th>
                           <th className="px-3 py-3 font-bold text-center">C(10)</th>
                           <th className="px-3 py-3 font-bold text-center">D(15)</th>
                           <th className="px-4 py-3 font-bold text-center text-emerald-700">总分(100)</th>
                           <th className="px-4 py-3 font-bold text-center">级别</th>
                           <th className="px-4 py-3 font-bold text-right">操作</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-stone-100">
                         {scores.slice().reverse().map(score => {
                           const student = students.find(s => s.id === score.studentId);
                           const exam = exams.find(e => e.id === score.examId);
                           const result = calculateResult(score.partA, score.partB, score.partC, score.partD);
                           const isEditing = editingScoreId === score.id;

                           if (!student || !exam) return null;

                           return (
                             <tr key={score.id} className="hover:bg-stone-50/80 transition-colors">
                               <td className="px-4 py-4">
                                 <div className="font-bold text-stone-800">{student.name}</div>
                                 <div className="text-xs text-stone-500">{student.class}</div>
                               </td>
                               <td className="px-4 py-4 text-stone-600 font-medium">{exam.name}</td>
                               
                               {isEditing ? (
                                 <>
                                   <td className="px-2 py-2"><input type="number" min="0" max="10" className="w-16 px-2 py-1 border border-amber-300 rounded-lg text-center focus:ring-2 focus:ring-amber-500 outline-none" value={editForm.partA} onChange={e=>setEditForm({...editForm, partA: e.target.value})} /></td>
                                   <td className="px-2 py-2"><input type="number" min="0" max="15" className="w-16 px-2 py-1 border border-amber-300 rounded-lg text-center focus:ring-2 focus:ring-amber-500 outline-none" value={editForm.partB} onChange={e=>setEditForm({...editForm, partB: e.target.value})} /></td>
                                   <td className="px-2 py-2"><input type="number" min="0" max="10" className="w-16 px-2 py-1 border border-amber-300 rounded-lg text-center focus:ring-2 focus:ring-amber-500 outline-none" value={editForm.partC} onChange={e=>setEditForm({...editForm, partC: e.target.value})} /></td>
                                   <td className="px-2 py-2"><input type="number" min="0" max="15" className="w-16 px-2 py-1 border border-amber-300 rounded-lg text-center focus:ring-2 focus:ring-amber-500 outline-none" value={editForm.partD} onChange={e=>setEditForm({...editForm, partD: e.target.value})} /></td>
                                   <td className="px-4 py-4 text-center text-stone-400">-</td>
                                   <td className="px-4 py-4 text-center text-stone-400">-</td>
                                   <td className="px-4 py-4 text-right">
                                     <button onClick={saveEditScore} className="text-emerald-600 hover:text-emerald-800 p-1.5 bg-emerald-50 rounded-lg mr-2" title="保存"><CheckCircle className="w-4 h-4"/></button>
                                     <button onClick={() => setEditingScoreId(null)} className="text-stone-500 hover:text-stone-700 p-1.5 bg-stone-100 rounded-lg" title="取消"><X className="w-4 h-4"/></button>
                                   </td>
                                 </>
                               ) : (
                                 <>
                                   <td className="px-3 py-4 text-center text-stone-600">{score.partA}</td>
                                   <td className="px-3 py-4 text-center text-stone-600">{score.partB}</td>
                                   <td className="px-3 py-4 text-center text-stone-600">{score.partC}</td>
                                   <td className="px-3 py-4 text-center text-stone-600">{score.partD}</td>
                                   <td className="px-4 py-4 text-center font-bold text-emerald-700 bg-emerald-50/50 rounded-lg">{result.total}</td>
                                   <td className="px-4 py-4 text-center">
                                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${result.grade === 'F' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {result.grade}
                                      </span>
                                   </td>
                                   <td className="px-4 py-4 text-right">
                                      <button onClick={() => startEditScore(score)} className="text-amber-600 hover:text-amber-800 p-1.5 mr-2" title="编辑"><Edit3 className="w-4 h-4"/></button>
                                      <button onClick={() => handleDeleteScore(score.id, score.studentId)} className="text-red-500 hover:text-red-700 p-1.5" title="删除"><Trash2 className="w-4 h-4"/></button>
                                   </td>
                                 </>
                               )}
                             </tr>
                           );
                         })}
                         {scores.length === 0 && (
                           <tr>
                             <td colSpan="9" className="px-4 py-10 text-center text-stone-400 font-medium">暂无成绩数据，请在上方录入。</td>
                           </tr>
                         )}
                       </tbody>
                     </table>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'student-chart' && (
              <div className="space-y-6 animate-fadeIn">
                <h2 className="text-2xl font-bold text-stone-800 border-b-2 border-emerald-500 pb-2 inline-block">学生个人进展条形统计图</h2>
                <p className="text-stone-600 mb-4">查看每位学生在不同模拟试卷中的总分表现。</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {students.map(student => {
                    const data = getStudentChartData(student.id);
                    if (!data.some(d => d['总分'] !== null)) return null;

                    return (
                      <div key={student.id} className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center mb-4 border-b border-stone-100 pb-2">
                          <div>
                            <h3 className="font-bold text-stone-800 text-lg flex items-center"><UserCircle className="w-5 h-5 mr-2 text-emerald-500"/>{student.name}</h3>
                            <p className="text-xs font-medium text-stone-500 mt-1">班级: {student.class}</p>
                          </div>
                        </div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 20, right: 20, bottom: 5, left: -20 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                              <XAxis dataKey="name" tick={{fontSize: 12, fill: '#78716c', fontWeight: 600}} axisLine={false} tickLine={false} />
                              <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#78716c'}} axisLine={false} tickLine={false} />
                              <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: '1px solid #e7e5e4', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)' }} 
                                cursor={{fill: '#f5f5f4'}}
                              />
                              <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                              <Bar dataKey="总分" fill="#059669" radius={[4, 4, 0, 0]} barSize={40} name="考试总分" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'class-chart' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-2 border-emerald-500 pb-2">
                  <h2 className="text-2xl font-bold text-stone-800">班级进展与各部分分析统计图</h2>
                  <select 
                    value={activeClass}
                    onChange={(e) => setActiveClass(e.target.value)}
                    className="px-4 py-2 border border-stone-300 rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 bg-white font-medium outline-none"
                  >
                    {classes.map(c => <option key={c} value={c}>{c === '全部' ? '所有班级' : `${c} 班`}</option>)}
                  </select>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
                  <h3 className="font-bold text-stone-800 text-lg mb-2 flex items-center">
                    <BarChart2 className="w-5 h-5 mr-2 text-amber-500"/> 班级平均分条形统计图
                  </h3>
                  <p className="text-sm text-stone-500 mb-6">展示所选班级在历次模拟考试中的平均分对比。</p>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getClassChartData(activeClass)} margin={{ top: 20, right: 20, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                        <XAxis dataKey="name" tick={{fontSize: 12, fill: '#78716c', fontWeight:600}} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#78716c'}} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: '1px solid #e7e5e4', backgroundColor: 'rgba(255, 255, 255, 0.95)' }} 
                          cursor={{fill: '#f5f5f4'}}
                        />
                        <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                        <Bar dataKey="平均分" fill="#d97706" radius={[4, 4, 0, 0]} barSize={60} name={`${activeClass === '全部' ? '全校' : activeClass + '班'} 平均分`} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-stone-800 mt-10 mb-4 flex items-center">
                  <Leaf className="w-6 h-6 mr-2 text-emerald-600"/> 试卷各部分达标分析 (标准: 40%)
                </h3>
                <p className="text-stone-600 mb-6 text-sm">查看在各项考试中，A、B、C、D四个部分达标与未达标的学生分布。</p>
                
                {exams.map(exam => {
                  const analysis = getPartAnalysisData(exam.id, activeClass);
                  if (!Object.values(analysis).some(part => part.pass.length > 0 || part.fail.length > 0)) return null;

                  // 准备堆叠条形图数据
                  const stackData = [
                    { name: '部分 A', 达标: analysis.partA.pass.length, 未达标: analysis.partA.fail.length },
                    { name: '部分 B', 达标: analysis.partB.pass.length, 未达标: analysis.partB.fail.length },
                    { name: '部分 C', 达标: analysis.partC.pass.length, 未达标: analysis.partC.fail.length },
                    { name: '部分 D', 达标: analysis.partD.pass.length, 未达标: analysis.partD.fail.length },
                  ];

                  return (
                    <div key={exam.id} className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden mb-8">
                      <div className="bg-emerald-700 px-6 py-4 border-b border-emerald-800 flex justify-between items-center">
                        <h4 className="font-bold text-white tracking-wide text-lg">{exam.name} - 各部分分析</h4>
                        <span className="text-emerald-100 text-sm">达标线: 满分的 40%</span>
                      </div>
                      
                      <div className="p-6">
                        {/* 堆叠条形图 */}
                        <div className="h-64 mb-8">
                          <h5 className="text-center font-bold text-stone-600 mb-4 text-sm">各部分达标人数统计 (堆叠条形图)</h5>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stackData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7e5e4" />
                              <XAxis type="number" tick={{fontSize: 12, fill: '#78716c'}} axisLine={false} tickLine={false} allowDecimals={false} />
                              <YAxis dataKey="name" type="category" tick={{fontSize: 12, fill: '#78716c', fontWeight: 600}} axisLine={false} tickLine={false} width={80} />
                              <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: '1px solid #e7e5e4', backgroundColor: 'rgba(255, 255, 255, 0.95)' }} 
                                cursor={{fill: '#f5f5f4'}}
                              />
                              <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                              <Bar dataKey="达标" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="达标人数" barSize={30} />
                              <Bar dataKey="未达标" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} name="未达标人数" barSize={30} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* 详细名单详情 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6 border-t border-stone-100">
                          <PartAnalysisCard title="部分 A (满分 10)" data={analysis.partA} />
                          <PartAnalysisCard title="部分 B (满分 15)" data={analysis.partB} />
                          <PartAnalysisCard title="部分 C (满分 10)" data={analysis.partC} />
                          <PartAnalysisCard title="部分 D (满分 15)" data={analysis.partD} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'admin-logs' && isAdmin && (
              <div className="space-y-6 animate-fadeIn">
                <h2 className="text-2xl font-bold text-stone-800 border-b-2 border-emerald-500 pb-2 inline-block">系统活动日志</h2>
                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                   <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                       <thead className="bg-stone-50 text-stone-500 uppercase text-xs border-b border-stone-200">
                         <tr>
                           <th className="px-6 py-4 font-bold">时间</th>
                           <th className="px-6 py-4 font-bold">操作用户</th>
                           <th className="px-6 py-4 font-bold">活动描述</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-stone-100">
                         {logs.map((log, i) => (
                           <tr key={i} className="hover:bg-stone-50">
                             <td className="px-6 py-3 whitespace-nowrap text-stone-500 text-xs font-medium">
                               {new Date(log.time).toLocaleString('zh-CN')}
                             </td>
                             <td className="px-6 py-3 font-bold text-stone-700">
                               <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${log.user === 'Admin' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                 {log.user}
                               </span>
                             </td>
                             <td className="px-6 py-3 text-stone-600 font-medium">{log.action}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
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
      className={`w-full flex items-center px-4 py-3.5 rounded-xl transition-all duration-200 font-bold ${
        active 
          ? 'bg-emerald-600 text-white shadow-md' 
          : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
      }`}
    >
      <span className={`mr-3 ${active ? 'text-white' : 'text-stone-400'}`}>
        {icon}
      </span>
      {label}
      {active && <ChevronRight className="w-4 h-4 ml-auto text-emerald-200" />}
    </button>
  );
}

function StatCard({ title, value, icon, bg }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 flex items-center transform transition-transform hover:-translate-y-1">
      <div className={`p-4 rounded-2xl ${bg} mr-4 shadow-inner`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-stone-500 mb-1">{title}</p>
        <p className="text-3xl font-extrabold text-stone-800">{value}</p>
      </div>
    </div>
  );
}

function PartAnalysisCard({ title, data }) {
  const total = data.pass.length + data.fail.length;
  const passPercent = total === 0 ? 0 : Math.round((data.pass.length / total) * 100);
  
  return (
    <div className="border border-stone-100 rounded-xl p-5 bg-stone-50/80 shadow-sm relative overflow-hidden">
      {/* 装饰用小叶子 */}
      <Leaf className="absolute top-2 right-2 w-8 h-8 text-emerald-600/5 rotate-45" />
      
      <h5 className="font-bold text-stone-800 mb-4 text-sm relative z-10">{title}</h5>
      
      <div className="mb-5 relative z-10">
        <div className="flex justify-between text-xs mb-1.5 font-bold">
          <span className="text-emerald-700">达标 ({passPercent}%)</span>
          <span className="text-red-500">{100 - passPercent}%</span>
        </div>
        <div className="w-full bg-red-100 rounded-full h-2.5 shadow-inner">
          <div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-700 ease-out" style={{ width: `${passPercent}%` }}></div>
        </div>
      </div>

      <div className="space-y-4 relative z-10">
        <div>
          <h6 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center">
            <CheckCircle className="w-3.5 h-3.5 mr-1" /> 已达标 ({data.pass.length})
          </h6>
          <div className="flex flex-wrap gap-1.5">
            {data.pass.length > 0 ? data.pass.map((name, i) => (
              <span key={i} className="text-xs bg-white text-emerald-700 px-2.5 py-1 rounded-md border border-emerald-200 shadow-sm font-medium">{name}</span>
            )) : <span className="text-xs text-stone-400 italic">无</span>}
          </div>
        </div>
        
        <div>
          <h6 className="text-xs font-bold text-red-800 uppercase tracking-wider mb-2 flex items-center">
            <AlertCircle className="w-3.5 h-3.5 mr-1" /> 未达标 ({data.fail.length})
          </h6>
          <div className="flex flex-wrap gap-1.5">
            {data.fail.length > 0 ? data.fail.map((name, i) => (
              <span key={i} className="text-xs bg-white text-red-600 px-2.5 py-1 rounded-md border border-red-200 shadow-sm font-medium">{name}</span>
            )) : <span className="text-xs text-stone-400 italic">无</span>}
          </div>
        </div>
      </div>
    </div>
  );
}