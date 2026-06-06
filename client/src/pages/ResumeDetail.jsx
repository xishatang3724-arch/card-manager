import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Button, Space, Spin, message,
  Modal, Input, Form, Select, Table, Divider,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getResume, updateResume, deleteResume } from '../services/api';

export default function ResumeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    setLoading(true);
    getResume(id)
      .then(data => setResume(data.resume))
      .catch(() => { message.error('简历不存在'); navigate('/resumes'); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleEdit = () => {
    form.setFieldsValue({
      name: resume.name,
      phone: resume.phone,
      email: resume.email,
      summary: resume.summary,
      skills: resume.skills || [],
    });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      const values = form.getFieldsValue();
      const data = await updateResume(id, values);
      setResume(data.resume);
      setEditing(false);
      message.success('已更新');
    } catch (err) {
      message.error('更新失败');
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: `确定删除${resume.name ? `「${resume.name}」的` : ''}简历？`,
      content: '此操作不可恢复',
      onOk: async () => {
        await deleteResume(id);
        message.success('已删除');
        navigate('/resumes');
      },
    });
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!resume) return null;

  const eduColumns = [
    { title: '学校', dataIndex: 'school', key: 'school' },
    { title: '学位', dataIndex: 'degree', key: 'degree' },
    { title: '专业', dataIndex: 'major', key: 'major' },
    { title: '时间', dataIndex: 'period', key: 'period' },
  ];

  const expColumns = [
    { title: '公司', dataIndex: 'company', key: 'company' },
    { title: '职位', dataIndex: 'position', key: 'position' },
    { title: '时间', dataIndex: 'period', key: 'period' },
    { title: '描述', dataIndex: 'description', key: 'description' },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/resumes')}>返回列表</Button>
        <Button icon={<EditOutlined />} onClick={handleEdit}>编辑</Button>
        <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>删除</Button>
      </Space>

      <Card title={`简历 - ${resume.name || '未命名'}`}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="姓名">{resume.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="电话">{resume.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{resume.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{resume.created_at}</Descriptions.Item>
          <Descriptions.Item label="个人简介" span={2}>{resume.summary || '-'}</Descriptions.Item>
          <Descriptions.Item label="技能" span={2}>
            {(resume.skills || []).map(s => <Tag key={s} color="green">{s}</Tag>)}
            {(!resume.skills || resume.skills.length === 0) && '-'}
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        {(resume.education || []).length > 0 && (
          <Card title="教育经历" type="inner" style={{ marginBottom: 16 }}>
            <Table dataSource={resume.education} columns={eduColumns} rowKey={(r, i) => i} pagination={false} />
          </Card>
        )}

        {(resume.experience || []).length > 0 && (
          <Card title="工作经历" type="inner">
            <Table dataSource={resume.experience} columns={expColumns} rowKey={(r, i) => i} pagination={false} />
          </Card>
        )}
      </Card>

      <Modal title="编辑简历" open={editing} onOk={handleSave} onCancel={() => setEditing(false)}
        okText="保存" cancelText="取消" width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名"><Input /></Form.Item>
          <Form.Item name="phone" label="电话"><Input /></Form.Item>
          <Form.Item name="email" label="邮箱"><Input /></Form.Item>
          <Form.Item name="summary" label="个人简介"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="skills" label="技能">
            <Select mode="tags" placeholder="输入技能后回车" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
