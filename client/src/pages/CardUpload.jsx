import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Card, Descriptions, Tag, Button, Spin, Space, message, Result } from 'antd';
import { InboxOutlined, ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { uploadCard } from '../services/api';

const { Dragger } = Upload;

export default function CardUpload() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = async (file) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await uploadCard(file);
      setResult(data.card);
      message.success('名片识别成功！');
    } catch (err) {
      const msg = err.response?.data?.error?.message || '上传或识别失败，请重试';
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
    return false; // Prevent default upload behavior
  };

  if (result) {
    return (
      <Card title={
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回</Button>
          <span>识别结果</span>
        </Space>
      }>
        <Result
          status="success"
          title="名片识别完成"
          subTitle={`已成功识别「${result.name}」的名片信息`}
          extra={[
            <Button key="view" type="primary" onClick={() => navigate(`/cards/${result.id}`)}>
              查看详情
            </Button>,
            <Button key="again" icon={<PlusOutlined />} onClick={() => { setResult(null); setError(null); }}>
              继续上传
            </Button>,
          ]}
        />
        <Descriptions bordered column={1} style={{ marginTop: 16 }}>
          <Descriptions.Item label="姓名">{result.name}</Descriptions.Item>
          <Descriptions.Item label="公司">{result.company || '-'}</Descriptions.Item>
          <Descriptions.Item label="电话">{result.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{result.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="行业">
            {result.industry ? <Tag color="blue">{result.industry}</Tag> : '分析中...'}
          </Descriptions.Item>
          <Descriptions.Item label="业务">{result.business || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回列表</Button>
      </Space>

      <Card title="上传名片">
        <Spin spinning={loading} tip="正在识别名片信息...">
          <Dragger
            name="file"
            multiple={false}
            accept="image/jpeg,image/png,image/webp"
            showUploadList={false}
            beforeUpload={handleUpload}
            disabled={loading}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽名片图片到此区域上传</p>
            <p className="ant-upload-hint">
              支持 JPG / PNG / WebP 格式，单张不超过 10MB
            </p>
          </Dragger>
        </Spin>

        {error && (
          <Result
            status="error"
            title="识别失败"
            subTitle={error}
            extra={<Button onClick={() => { setResult(null); setError(null); }}>重新上传</Button>}
          />
        )}
      </Card>
    </div>
  );
}
