import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import axios from 'axios';
import Hls from 'hls.js'; // Đảm bảo đã chạy: npm install hls.js

// [COMPONENT TRÌNH PHÁT VIDEO M3U8 - SẠCH QUẢNG CÁO]
const VideoPlayer = ({ url }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    if (url && videoRef.current) {
      const video = videoRef.current;

      if (Hls.isSupported()) {
        if (hlsRef.current) hlsRef.current.destroy();
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => console.log("Cần tương tác để phát"));
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', () => {
          video.play();
        });
      }
    }
    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, [url]);

  return (
    <div className="relative w-full h-full bg-black">
      <video 
        ref={videoRef} 
        controls 
        className="w-full h-full outline-none shadow-2xl"
        poster="https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=1400"
      />
    </div>
  );
};

// [CARD PHIM SPOTLIGHT]
const MovieCard = memo(({ movie, onClick, isRecent = false }) => {
  const getEpDisplay = () => {
    if (isRecent) return `ĐANG XEM: TẬP ${movie.lastEp?.toString().replace(/Tập\s*/i, '').toUpperCase() || '1'}`;
    const rawEp = movie.episode_current || movie.last_episode || "HD";
    return `TẬP ${rawEp.toString().replace(/Tập\s*/i, '').toUpperCase()}`;
  };

  return (
    <div onClick={() => onClick(movie.slug)} className="group cursor-pointer relative animate-in fade-in zoom-in duration-500">
      <div className="relative rounded-xl overflow-hidden bg-zinc-900 border border-white/5 transition-all duration-700 group-hover:scale-110 group-hover:rotate-[-2deg] group-hover:border-white/20 group-hover:shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_20px_rgba(255,255,255,0.05)]">
        <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent z-10" />
        <div className="absolute top-2 left-2 z-20">
          <span className="bg-black/40 backdrop-blur-md border border-white/10 text-white text-[9px] font-black px-2 py-1 rounded uppercase tracking-tighter">
            {movie.lang || 'VIETSUB'}
          </span>
        </div>
        <img 
          src={movie.poster_url?.startsWith('http') ? movie.poster_url : `https://phimimg.com/${movie.poster_url}`} 
          loading="lazy" 
          className="w-full aspect-[2/3] object-cover transition duration-700 group-hover:brightness-125" 
          alt={movie.name} 
        />
        <div className="absolute bottom-2 right-2 z-20">
          <span className="bg-black/40 backdrop-blur-md border border-white/10 text-gray-100 text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-xl">
            {getEpDisplay()}
          </span>
        </div>
      </div>
      <div className="mt-3 px-1 transition-transform duration-500 group-hover:translate-x-1">
        <h4 className="text-[12px] font-black uppercase truncate text-gray-100 group-hover:text-red-600 transition-colors">
          {movie.name}
        </h4>
        <p className="text-[13px] font-bold text-gray-600 mt-1">{movie.year}</p>
      </div>
    </div>
  );
});

function App() {
  const [sections, setSections] = useState({ hot: [], anime: [], hhtq: [], cine: [], korea: [], china: [], search: [] });
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [playerUrl, setPlayerUrl] = useState('');
  const [activeEp, setActiveEp] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('home');
  const [currentBanner, setCurrentBanner] = useState(0); 
  const playerRef = useRef(null);

  const sortNewest = useCallback((list) => {
    return list ? [...list].sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0)) : [];
  }, []);

  const fetchData = useCallback(async (mode = 'home', page = 1, query = '') => {
    setViewMode(mode); 
    setCurrentPage(page);
    try {
      if (mode === 'home') {
        const [resHot, resAnime, resCine, resKorea, resChina] = await Promise.all([
          axios.get(`https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=${page}`),
          axios.get(`https://phimapi.com/v1/api/danh-sach/hoat-hinh?limit=24&page=${page}`),
          axios.get(`https://phimapi.com/v1/api/danh-sach/phim-le?limit=24&page=${page}`),
          axios.get(`https://phimapi.com/v1/api/quoc-gia/han-quoc?limit=24&page=${page}`),
          axios.get(`https://phimapi.com/v1/api/quoc-gia/trung-quoc?limit=24&page=${page}`)
        ]);
        setSections({
          hot: sortNewest(resHot.data.items).slice(0, 8), 
          anime: sortNewest(resAnime.data.data.items.filter(i => !i.origin_name?.toLowerCase().includes('china'))).slice(0, 8),
          hhtq: sortNewest(resAnime.data.data.items.filter(i => i.origin_name?.toLowerCase().includes('china') || i.country?.some(c => c.slug === 'trung-quoc'))).slice(0, 8),
          cine: sortNewest(resCine.data.data.items).slice(0, 8),
          korea: sortNewest(resKorea.data.data.items).slice(0, 8),
          china: sortNewest(resChina.data.data.items).slice(0, 8),
          search: []
        });
      } else if (mode === 'search') {
        const res = await axios.get(`https://phimapi.com/v1/api/tim-kiem?keyword=${query}&limit=32`);
        setSections(prev => ({ ...prev, search: sortNewest(res.data.data.items) }));
      }
    } catch (err) { console.error("Lỗi API:", err); }
  }, [sortNewest]);

  useEffect(() => { 
    fetchData('home', 1);
    const timer = setInterval(() => setCurrentBanner(p => (p + 1) % 5), 6000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const handleWatch = async (slug, epIndex = 0) => {
    try {
      const res = await axios.get(`https://phimapi.com/phim/${slug}`);
      const { movie, episodes: eps } = res.data;
      setSelectedMovie(movie); 
      setEpisodes(eps);
      
      // FIX LẤY LINK M3U8 SERVER 0
      const currentServer = eps[0];
      if (currentServer && currentServer.server_data[epIndex]) {
        const link = currentServer.server_data[epIndex].link_m3u8 || currentServer.server_data[epIndex].link_embed;
        setPlayerUrl(link);
      }
      
      setActiveEp(epIndex);
      setTimeout(() => playerRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
    } catch (err) { console.error("Lỗi xem phim:", err); }
  };

  return (
    <div className="w-full min-h-screen bg-[#050505] text-white font-sans pb-20 overflow-x-hidden">
      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-[100] px-6 md:px-12 py-5 flex flex-col md:flex-row justify-between items-center bg-black/80 backdrop-blur-2xl border-b border-white/5 gap-4">
        <h1 className="text-red-600 text-3xl font-black tracking-tighter cursor-pointer" 
            onClick={() => { fetchData('home', 1); setSelectedMovie(null); }}>LÂM'S HOUSE</h1>
        <form onSubmit={(e) => { e.preventDefault(); fetchData('search', 1, searchQuery); setSelectedMovie(null); }}>
          <input 
            type="text" placeholder="TÌM PHIM NGAY..." value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="bg-white/5 border border-white/10 rounded-full px-8 py-3 text-[13px] font-bold w-64 md:w-[400px] focus:border-red-600 outline-none uppercase" 
          />
        </form>
      </nav>

      <div className="pt-36 md:pt-28">
        {/* BANNER */}
        {viewMode === 'home' && !selectedMovie && sections.hot.length > 0 && (
          <div className="px-6 md:px-12 mb-16">
            <div className="relative w-full h-[60vh] md:h-[85vh] rounded-[2rem] md:rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl bg-zinc-950">
              {sections.hot.slice(0, 5).map((movie, index) => (
                <div key={movie.slug} className={`absolute inset-0 transition-opacity duration-[1500ms] ${currentBanner === index ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                  <img src={movie.thumb_url} className="w-full h-full object-cover brightness-75" alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-6 text-center w-full px-4">
                    <h2 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter max-w-2xl">{movie.name}</h2>
                    <button onClick={() => handleWatch(movie.slug)} className="bg-red-600 text-white px-10 py-3 rounded-2xl font-black uppercase text-[11px] hover:scale-110 transition-all shadow-xl">
                      Xem ngay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PLAYER */}
        {selectedMovie && (
          <div ref={playerRef} className="w-full mb-16 px-4 md:px-0">
            <div className="max-w-[1400px] mx-auto rounded-[2rem] shadow-2xl border border-white/5 aspect-video bg-black overflow-hidden relative">
               <VideoPlayer url={playerUrl} />
            </div>
            <div className="max-w-[1400px] mx-auto mt-10 p-6 md:p-8 bg-zinc-900/60 backdrop-blur-3xl rounded-[2.5rem] border border-white/5">
                <div className="flex flex-wrap gap-2 mb-8">
                    {episodes[0]?.server_data.map((ep, i) => (
                      <button key={i} onClick={() => {setPlayerUrl(ep.link_m3u8 || ep.link_embed); setActiveEp(i);}} 
                      className={`min-w-[60px] py-3 px-4 rounded-xl text-[12px] font-black transition-all ${activeEp === i ? 'bg-red-600 text-white scale-110' : 'bg-white/5 hover:bg-white/10 text-gray-400'}`}>
                        {ep.name}
                      </button>
                    ))}
                </div>
                <h2 className="text-2xl md:text-3xl font-black uppercase text-red-600 italic tracking-tighter">{selectedMovie.name}</h2>
            </div>
          </div>
        )}

        {/* SECTIONS */}
        <div className="space-y-20">
          {viewMode === 'search' && <SectionRow title="Kết quả tìm kiếm" data={sections.search} color="bg-yellow-500" MovieCard={MovieCard} onClick={handleWatch} />}
          <SectionRow title="Hot Trending" data={sections.hot} color="bg-red-600" MovieCard={MovieCard} onClick={handleWatch} />
          <SectionRow title="Anime Nhật Bản" data={sections.anime} color="bg-orange-400" MovieCard={MovieCard} onClick={handleWatch} />
          <SectionRow title="Cine Rạp" data={sections.cine} color="bg-purple-500" MovieCard={MovieCard} onClick={handleWatch} />
          <SectionRow title="Drama Hàn Quốc" data={sections.korea} color="bg-pink-500" MovieCard={MovieCard} onClick={handleWatch} />
          <SectionRow title="Drama Trung Quốc" data={sections.china} color="bg-cyan-500" MovieCard={MovieCard} onClick={handleWatch} />
        </div>
      </div>

      {/* PAGINATION */}
      {viewMode === 'home' && !selectedMovie && (
        <div className="flex justify-center items-center gap-3 mt-24 pb-10">
          {[1, 2, 3, 4, 5].map(p => (
            <button key={p} onClick={() => fetchData('home', p)} 
            className={`w-12 h-12 rounded-xl font-black text-[14px] transition-all ${currentPage === p ? 'bg-red-600 text-white' : 'bg-zinc-900 text-gray-500 hover:text-white'}`}>
              0{p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SectionRow = memo(({ title, data, color, MovieCard, onClick }) => (
  data.length > 0 && (
    <div className="px-6 md:px-12">
      <h3 className="text-2xl font-black italic flex items-center gap-3 mb-8 uppercase">
        <span className={`w-1.5 h-7 ${color} rounded-full`}></span> {title}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-6">
        {data.map(m => <MovieCard key={m.slug} movie={m} onClick={onClick} />)}
      </div>
    </div>
  )
));

export default App;