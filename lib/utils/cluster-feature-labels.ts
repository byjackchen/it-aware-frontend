/**
 * Display labels for worker-cluster feature keys.
 * Behavior features (28) drive the clustering and are shown on radar charts.
 * Label features (is_vip, is_new_hire) are stored separately as overlay.
 */
export const FEATURE_LABELS: Record<string, { en: string; zh: string }> = {
    // Behavior features (28)
    tenure_months: { en: 'Tenure (months)', zh: '司龄（月）' },
    location_region: { en: 'Region', zh: '地区' },
    org_depth: { en: 'Org Depth', zh: '组织层级' },
    incident_count: { en: 'Incident Count', zh: '工单数' },
    incident_monthly_rate: { en: 'Incidents/Month', zh: '月均工单' },
    incident_avg_resolution_hours: { en: 'Avg Resolution (hrs)', zh: '平均解决时长' },
    incident_high_priority_ratio: { en: 'High Priority %', zh: '高优先级占比' },
    incident_self_service_ratio: { en: 'Self-Service %', zh: '自助渠道占比' },
    incident_avg_chat_rounds: { en: 'Chat Rounds', zh: '对话轮数' },
    request_count: { en: 'Request Count', zh: '申请数' },
    request_monthly_rate: { en: 'Requests/Month', zh: '月均申请' },
    request_self_service_ratio: { en: 'Request Self-Service %', zh: '申请自助占比' },
    interaction_count: { en: 'Interaction Count', zh: '互动数' },
    interaction_query_ratio: { en: 'Query %', zh: '文字查询占比' },
    interaction_click_ratio: { en: 'Click %', zh: '点击占比' },
    catalog_ratio_0: { en: 'Auth Error %', zh: '认证错误占比' },
    catalog_ratio_1: { en: 'Account Mgmt %', zh: '账号管理占比' },
    catalog_ratio_2: { en: 'Software %', zh: '软件问题占比' },
    catalog_ratio_3: { en: 'Access Request %', zh: '权限申请占比' },
    catalog_ratio_4: { en: 'App Outage %', zh: '应用故障占比' },
    profile_topic_count: { en: 'Profile Topics', zh: '画像主题数' },
    profile_tag_count: { en: 'Profile Tags', zh: '画像标签数' },
    off_hours_ratio: { en: 'Off-Hours %', zh: '非工时占比' },
    // Label features (excluded from clustering, stored as overlay)
    is_vip: { en: 'VIP', zh: 'VIP' },
    is_new_hire: { en: 'New Hire', zh: '新员工' },
};
