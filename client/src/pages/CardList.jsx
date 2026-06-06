import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Input, Select, Tag, Space, Button, Image, message } from 'antd';
import { PlusOutlined, SearchOutlined, DeleteOutlined } from '@ant-design/icons';
import { getCards, deleteCard } from '../services/api';

export default function CardList() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState(undefined);
  const [companyFilter, setCompanyFilter] = useState(undefined);
  const [page, setPage] = useState(1);
  const [industries, setIndustries] = useState([]);
  const [companies, setCompanies] = useState([]);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (industryFilter) params.industry = industryFilter;
      if (companyFilter) params.company = companyFilter;

      const data = await getCards(params);
      setCards(data.cards || []);
      setTotal(data.total || 0);
    } catch (err) {
      message.error('加载名片列表失败');
    } finally {
      setLoading(false);
    }
  }, [search, industryFilter, companyFilter, page]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Load filter options on mount
  useEffect(() => {
    getCards({ limit: 1000 }).then(data => {
      const items = data.cards || [];
      setIndustries([...new Set(items.map(c => c.industry).filter(Boolean))]);
      setCompanies([...new Set(items.map(c => c.company).filter(Boolean))]);
    }).catch(() => {});
  }, []);

  const handleDelete = (id, name) => {
    if (!window.confirm(`确定删除"${name}"的名片？`)) return;
    deleteCard(id).then(() => {
      message.success('已删除');
      fetchCards();
    }).catch(() => message.error('删除失败'));
  };

  const columns = [
    {
      title: '名片',
      dataIndex: 'image_path',
      key: 'image',
      width: 100,
      render: (path) => path ? (
        <Image
          src={`/uploads/${path}`}
          width={72}
          height={50}
          style={{ objectFit: 'cover', borderRadius: 4 }}
          preview={{ mask: '预览' }}
        />
      ) : <div style={{ width: 72, height: 50, background: '#f0f0f0', borderRadius: 4 }} />,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <a onClick={() => navigate(`/cards/${record.id}`)}>{name}</a>
      ),
    },
    {
      title: '公司',
      dataIndex: 'company',
      key: 'company',
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
      title: '行业',
      dataIndex: 'industry',
      key: 'industry',
      render: (v) => v ? <Tag color="blue">{v}</Tag> : null,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags) => (tags || []).map(t => <Tag key={t}>{t}</Tag>),
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
          placeholder="搜索姓名、公司、电话、邮箱"
          allowClear
          onSearch={(val) => { setSearch(val); setPage(1); }}
          style={{ width: 280 }}
          prefix={<SearchOutlined />}
        />
        <Select
          placeholder="按行业筛选"
          allowClear
          style={{ width: 160 }}
          value={industryFilter}
          onChange={(val) => { setIndustryFilter(val); setPage(1); }}
          options={industries.map(i => ({ label: i, value: i }))}
        />
        <Select
          placeholder="按公司筛选"
          allowClear
          style={{ width: 200 }}
          value={companyFilter}
          onChange={(val) => { setCompanyFilter(val); setPage(1); }}
          options={companies.map(c => ({ label: c, value: c }))}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/upload')}
        >
          上传名片
        </Button>
      </div>

      <Table
        dataSource={cards}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: 20,
          total,
          onChange: setPage,
          showTotal: (t) => `共 ${t} 张名片`,
        }}
        locale={{ emptyText: '暂无名片，点击"上传名片"开始添加' }}
      />
    </div>
  );
}
