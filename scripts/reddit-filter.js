/**
 * Reddit 去广告脚本
 * 过滤 API 响应中的推广帖（is_promoted=true）
 */

(function() {
    try {
        let body = $response.body;
        if (!body) {
            $done({});
            return;
        }
        
        let data = JSON.parse(body);
        
        // 过滤函数：递归删除推广内容
        function filterAds(obj) {
            if (Array.isArray(obj)) {
                return obj.filter(item => {
                    if (item && typeof item === 'object') {
                        // 检查是否为推广帖
                        if (item.data && item.data.is_promoted === true) return false;
                        if (item.is_promoted === true) return false;
                        if (item.promoted === true) return false;
                        if (item.data && item.data.promoted === true) return false;
                        // 检查广告标识
                        if (item.kind === 't3' && item.data && item.data.is_sponsored) return false;
                    }
                    return true;
                }).map(item => filterAds(item));
            } else if (obj && typeof obj === 'object') {
                for (let key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        obj[key] = filterAds(obj[key]);
                    }
                }
                return obj;
            }
            return obj;
        }
        
        // 处理不同 API 响应格式
        if (data.data && data.data.children) {
            // Listing 格式
            data.data.children = filterAds(data.data.children);
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
