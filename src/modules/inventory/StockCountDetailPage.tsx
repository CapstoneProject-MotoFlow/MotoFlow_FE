import { useParams } from 'react-router-dom'
import CountLiveDetail from './CountLiveDetail'
export default function StockCountDetailPage(){const {id}=useParams();return <CountLiveDetail key={id}/>}
