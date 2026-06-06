import { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Tabs } from 'antd';
import { IdcardOutlined, FileTextOutlined } from '@ant-design/icons';
import CardList from './pages/CardList';
import CardUpload from './pages/CardUpload';
import CardDetail from './pages/CardDetail';
import ResumeList from './pages/ResumeList';
import ResumeUpload from './pages/ResumeUpload';
import ResumeDetail from './pages/ResumeDetail';

function AppTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeKey, setActiveKey] = useState(
    location.pathname.startsWith('/resume') ? 'resumes' : 'cards'
  );

  const onChange = (key) => {
    setActiveKey(key);
    navigate(key === 'cards' ? '/cards' : '/resumes');
  };

  return (
    <div className="app-header">
      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='22' height='22'%3E%3Cpath fill='%231677ff' d='M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z'/%3E%3C/svg%3E"
        alt="" style={{ marginRight: 8 }} />
      <Tabs
        activeKey={activeKey}
        onChange={onChange}
        items={[
          { key: 'cards', label: <><IdcardOutlined /> 名片</> },
          { key: 'resumes', label: <><FileTextOutlined /> 简历</> },
        ]}
        style={{ marginBottom: 0 }}
        tabBarStyle={{ marginBottom: 0 }}
      />
    </div>
  );
}

export default function App() {
  return (
    <div>
      <AppTabs />
      <div className="app-content">
        <Routes>
          <Route path="/" element={<CardList />} />
          <Route path="/cards" element={<CardList />} />
          <Route path="/cards/:id" element={<CardDetail />} />
          <Route path="/upload" element={<CardUpload />} />
          <Route path="/resumes" element={<ResumeList />} />
          <Route path="/resumes/:id" element={<ResumeDetail />} />
          <Route path="/resume/upload" element={<ResumeUpload />} />
        </Routes>
      </div>
    </div>
  );
}
