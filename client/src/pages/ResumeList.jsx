import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Input, Select, Tag, Space, Button, message } from 'antd';
import { PlusOutlined, SearchOutlined, DeleteOutlined } from '@ant-design/icons';
import { getResumes, deleteResume } from '../services/api';

export default function ResumeList() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState(undefined);
  const [page, setPage] = useState(1);
  const [allSkills, setAllSkills] = useState([]);

  const fetchResumes = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (skillFilter) params.skill = skillFilter;

      const data = await getResumes(params);
      setResumes(data.resumes || []);
      setTotal(data.total || 0);
    } catch (err) {
      message.error('加载简历列表失败');
    } finally {
      setLoading(false);
    }
  }, [search, skillFilter, page]);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  useEffect(() => {
    getResumes({ limit: 1000 }).then(data => {
      const items = data.resumes || [];
      const skills = [...new Set(items.flatMap(r => r.skills || []).filter(Boolean))];
      setAllSkills(skills);
    }).catch(() => {});
  }, []);

  const handleDelete = (id, name) => {
    if (!window.confirm(`确定删除${name ? `"${name}"的` : ''}这份简历？`)) return;
    deleteResume(id).then(() => {
      message.success('已删除');
      fetchResumes();
    }).catch(() => message.error('删除失败'));
  };

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <a onClick={() => navigate(`/resumes/${record.id}`)}>{name || '未命名'}</a>
      ),
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: '技能',
      dataIndex: 'skills',
      key: 'skills',
      render: (skills) => (skills || []).slice(0, 4).map(s => <Tag key={s} color="green">{s}</Tag>),
    },
    {
      title: '教育',
      dataIndex: 'education',
      key: 'education',
      render: (edu) => edu?.length ? `${edu[0].school} ${edu[0].degree || ''}` : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record.id, record.name)}
        />
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Input.Search
          placeholder="搜索姓名、邮箱、简介"
          allowClear
          onSearch={(val) => { setSearch(val); setPage(1); }}
          style={{ width: 280 }}
          prefix={<SearchOutlined />}
        />
        <Select
          placeholder="按技能筛选"
          allowClear
          style={{ width: 200 }}
          value={skillFilter}
          onChange={(val) => { setSkillFilter(val); setPage(1); }}
          options={allSkills.map(s => ({ label: s, value: s }))}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/resume/upload')}
        >
          上传简历
        </Button>
      </div>

      <Table
        dataSource={resumes}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: 20,
          total,
          onChange: setPage,
          showTotal: (t) => `共 ${t} 份简历`,
        }}
        locale={{ emptyText: '暂未简历，点击"上传简历"开始添加' }}
      />
    </div>
  );
}
