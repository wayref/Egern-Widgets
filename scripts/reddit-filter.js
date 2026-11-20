/**
 * Reddit 去广告脚本
 * 过滤 API 响应中的推广帖（is_promoted=true）
 * 支持 REST API 和 GraphQL 两种格式
 */

(function() {
    try {
        let body = $response.body;
        if (!body) {
            $done({});
            return;
        }
        
        let data = JSON.parse(body);
        
        // 检查单个帖子是否为广告
        function isAd(item) {
            if (!item || typeof item !== 'object') return false;
            
            // REST API 格式
            if (item.data) {
                if (item.data.is_promoted === true) return true;
                if (item.data.promoted === true) return true;
                if (item.data.is_sponsored === true) return true;
                if (item.data.distinguished === 'promoted') return true;
            }
            
            // 直接字段
            if (item.is_promoted === true) return true;
            if (item.promoted === true) return true;
            if (item.is_sponsored === true) return true;
            if (item.isAd === true) return true;
            if (item.ad === true) return true;
            
            // GraphQL 格式
            if (item.node && item.node.isPromoted) return true;
            if (item.node && item.node.isSponsored) return true;
            
            // 检查广告标识
            if (item.kind === 't3' && item.data) {
                if (item.data.subreddit_type === 'public' && item.data.is_promoted) return true;
            }
            
            return false;
        }
        
        // 过滤函数：递归删除推广内容
        function filterAds(obj) {
            if (Array.isArray(obj)) {
                return obj.filter(item => !isAd(item)).map(item => filterAds(item));
            } else if (obj && typeof obj === 'object') {
                // GraphQL edges 格式
                if (obj.edges && Array.isArray(obj.edges)) {
                    obj.edges = obj.edges.filter(edge => {
                        if (edge && edge.node) {
                            return !isAd(edge.node) && !isAd(edge);
                        }
                        return true;
                    });
                }
                
                for (let key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        // 跳过已经过滤的 edges
                        if (key === 'edges' && Array.isArray(obj[key])) {
                            obj[key] = obj[key].map(edge => filterAds(edge));
                        } else {
                            obj[key] = filterAds(obj[key]);
                        }
                    }
                }
                return obj;
            }
            return obj;
        }
        
        // 处理不同 API 响应格式
        if (data.data && data.data.children) {
            // Listing 格式 (REST API)
            data.data.children = filterAds(data.data.children);
        } else if (data.data && data.data.edges) {
            // GraphQL 格式
            data = filterAds(data);
        } else if (data.posts) {
            // Posts 格式
            data.posts = filterAds(data.posts);
        } else if (Array.isArray(data)) {
            data = filterAds(data);
        } else {
            data = filterAds(data);
        }
        
        $done({ body: JSON.stringify(data) });
    } catch (e) {
        // 解析失败时返回原内容
        $done({});
    }
})();
