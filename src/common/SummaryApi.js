export const baseURL = import.meta.env.VITE_APP_SERVER_DOMAIN ||"http://localhost:8000"



const SummaryApi = {
    register : {
        url : '/api/user/register',
        method : 'post'
    }
    
 
}

export default SummaryApi;