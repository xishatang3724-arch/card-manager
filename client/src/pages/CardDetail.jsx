import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Image, Button, Space, Spin, message,
  Modal, Input, Form, Select,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getCard, updateCard, deleteCard } from '../services/api';

export default function CardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    setLoading(true);
    getCard(id)
      .then(data => setCard(data.card))
      .catch(() => {
        message.error('名片不存在');
        navigate('/');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleEdit = () => {
    form.setFieldsValue({
      name: card.name,
      company: card.company,
      phone: card.phone,
      email: card.email,
      industry: card.industry,
      business: card.business,
      company_info: card.company_info,
      tags: card.tags || [],
    });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      const values = form.getFieldsValue();
      const data = await updateCard(id, values);
      setCard(data.card);
      setEditing(false);
      message.success('已更新');
    } catch (err) {
      message.error('更新失败');
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: `确定删除「${card.name}」的名片？`,
      content: '此操作不可恢复',
      onOk: async () => {
        await deleteCard(id);
        message.success('已删除');
        navigate('/');
      },
    });
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!card) return null;

  const previewUrl = card.image_path ? `/uploads/${card.image_path}` : null;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回列表</Button>
        <Button icon={<EditOutlined />} onClick={handleEdit}>编辑</Button>
        <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>删除</Button>
      </Space>

      <Card title={`名片 - ${card.name}`}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          {previewUrl && (
            <Image
              src={previewUrl}
              width={200}
              style={{ borderRadius: 8, objectFit: 'contain' }}
              alt="名片图片"
            />
          )}
          <Descriptions bordered column={2} style={{ flex: 1 }}>
            <Descriptions.Item label="姓名">{card.name}</Descriptions.Item>
            <Descriptions.Item label="公司">{card.company || '-'}</Descriptions.Item>
            <Descriptions.Item label="电话">{card.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{card.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="标签">
              {(card.tags || []).map(t => <Tag key={t} color="geekblue">{t}</Tag>)}
              {(!card.tags || card.tags.length === 0) && '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{card.created_at}</Descriptions.Item>
          </Descriptions>
        </div>

        <Card title="AI 公司分析" type="inner" style={{ marginTop: 16 }}>
          {card.industry || card.business ? (
            <Descriptions bordered column={1}>
              <Descriptions.Item label="行业">
                {card.industry ? <Tag color="blue">{card.industry}</Tag> : '未知'}
              </Descriptions.Item>
              <Descriptions.Item label="主要业务">{card.business || '未知'}</Descriptions.Item>
              <Descriptions.Item label="公司简介">{card.company_info || '未知'}</Descriptions.Item>
            </Descriptions>
          ) : (
            <p style={{ color: '#999' }}>无公司信息</p>
          )}
        </Card>
      </Card>

      <Modal
        title="编辑名片"
        open={editing}
        onOk={handleSave}
        onCancel={() => setEditing(false)}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="company" label="公司">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input />
          </Form.Item>
          <Form.Item name="industry" label="行业">
            <Input />
          </Form.Item>
          <Form.Item name="business" label="业务">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="company_info" label="公司简介">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签后回车" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
