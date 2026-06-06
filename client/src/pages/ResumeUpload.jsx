import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Card, Descriptions, Tag, Button, Spin, Space, message, Result, Table } from 'antd';
import { InboxOutlined, ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { uploadResume } from '../services/api';

const { Dragger } = Upload;

export default function ResumeUpload() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = async (file) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await uploadResume(file);
      setResult(data.resume);
      message.success('简历识别成功！');
    } catch (err) {
      const msg = err.response?.data?.error?.message || '上传或识别失败，请重试';
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
    return false;
  };

  if (result) {
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
      <Card title={
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/resumes')}>返回</Button>
          <span>识别结果</span>
        </Space>
      }>
        <Result
          status="success"
          title="简历识别完成"
          subTitle={`已识别${result.name ? `「${result.name}」的` : ''}简历信息`}
          extra={[
            <Button key="view" type="primary" onClick={() => navigate(`/resumes/${result.id}`)}>
              查看详情
            </Button>,
            <Button key="again" icon={<PlusOutlined />} onClick={() => { setResult(null); setError(null); }}>
              继续上传
            </Button>,
          ]}
        />
        <Descriptions bordered column={2} style={{ marginTop: 16 }}>
          <Descriptions.Item label="姓名" span={2}>{result.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="电话">{result.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{result.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="个人简介" span={2}>{result.summary || '-'}</Descriptions.Item>
          <Descriptions.Item label="技能" span={2}>
            {(result.skills || []).map(s => <Tag key={s} color="green">{s}</Tag>)}
            {(!result.skills || result.skills.length === 0) && '-'}
          </Descriptions.Item>
        </Descriptions>
        {(result.education || []).length > 0 && (
          <Card title="教育经历" type="inner" style={{ marginTop: 16 }}>
            <Table dataSource={result.education} columns={eduColumns} rowKey="school" pagination={false} />
          </Card>
        )}
        {(result.experience || []).length > 0 && (
          <Card title="工作经历" type="inner" style={{ marginTop: 16 }}>
            <Table dataSource={result.experience} columns={expColumns} rowKey={(r, i) => i} pagination={false} />
          </Card>
        )}
      </Card>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/resumes')}>返回列表</Button>
      </Space>
      <Card title="上传简历">
        <Spin spinning={loading} tip="正在识别简历信息...">
          <Dragger
            name="file"
            multiple={false}
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            showUploadList={false}
            beforeUpload={handleUpload}
            disabled={loading}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">点击或拖拽简历文件到此区域上传</p>
            <p className="ant-upload-hint">支持 PDF / JPG / PNG 格式，单张不超过 10MB</p>
          </Dragger>
        </Spin>
        {error && (
          <Result status="error" title="识别失败" subTitle={error}
            extra={<Button onClick={() => { setResult(null); setError(null); }}>重新上传</Button>}
          />
        )}
      </Card>
    </div>
  );
}
