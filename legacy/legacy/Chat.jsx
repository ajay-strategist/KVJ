import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import DashboardLayout from '../components/DashboardLayout';
import { API_BASE_URL } from '../config';
import {
    Hash,
    Users,
    MessageSquare,
    Plus,
    Paperclip,
    Send,
    X,
    MessageCircle,
    FileText,
    Download,
    UserPlus,
    Check,
    User,
} from 'lucide-react';

export default function Chat() {
    const socket = useSocket();
    const [channels, setChannels] = useState([]);
    const [dms, setDms] = useState([]);
    const [users, setUsers] = useState([]);
    const [activeChannel, setActiveChannel] = useState(null);

    const [messages, setMessages] = useState([]);
    const [threadMessages, setThreadMessages] = useState([]);
    const [activeThread, setActiveThread] = useState(null);

    const [newMessage, setNewMessage] = useState('');
    const [threadReply, setThreadReply] = useState('');
    const [file, setFile] = useState(null);
    const [threadFile, setThreadFile] = useState(null);

    const [showChannelModal, setShowChannelModal] = useState(false);
    const [newChannelForm, setNewChannelForm] = useState({
        name: '',
        description: '',
        members: [],
    });
    const [channelSearchUser, setChannelSearchUser] = useState('');

    const [showMembersModal, setShowMembersModal] = useState(false);
    const [mentionBadges, setMentionBadges] = useState({});
    const [dmUserQuery, setDmUserQuery] = useState('');

    const messagesEndRef = useRef(null);
    const threadEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const threadFileInputRef = useRef(null);

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (msg) => {
            setMessages((prev) => {
                if (msg.channel === activeChannel?._id) {
                    if (!prev.find((m) => m._id === msg._id)) {
                        return [...prev, msg];
                    }
                    return prev;
                }
                return prev;
            });
        };

        const handleThreadReply = (msg) => {
            setMessages((prev) =>
                prev.map((m) =>
                    m._id === msg.parentId ? { ...m, replyCount: (m.replyCount || 0) + 1 } : m,
                ),
            );
            setThreadMessages((prev) => {
                if (activeThread?._id === msg.parentId && !prev.find((m) => m._id === msg._id)) {
                    return [...prev, msg];
                }
                return prev;
            });
        };

        const handleMention = ({ channelId, message }) => {
            if (activeChannel?._id !== channelId) {
                setMentionBadges((prev) => ({ ...prev, [channelId]: (prev[channelId] || 0) + 1 }));
            }
        };

        socket.on('newMessage', handleNewMessage);
        socket.on('threadReply', handleThreadReply);
        socket.on('mention', handleMention);

        return () => {
            socket.off('newMessage', handleNewMessage);
            socket.off('threadReply', handleThreadReply);
            socket.off('mention', handleMention);
        };
    }, [socket, activeChannel, activeThread]);

    const [mentionQuery, setMentionQuery] = useState(null);
    const [mentionTargetIsThread, setMentionTargetIsThread] = useState(false);

    const getMentionableUsers = () => {
        if (!activeChannel || !mentionQuery === null) return [];
        const query = (mentionQuery || '').toLowerCase();

        let channelUsers = users;
        if (activeChannel.type === 'Team') {
            channelUsers = users.filter(
                (u) => u.team?._id === activeChannel.team || u.team === activeChannel.team,
            );
        } else if (activeChannel.type === 'Custom' || activeChannel.type === 'DM') {
            const memberIds = activeChannel.members.map((m) => m._id || m);
            channelUsers = users.filter((u) => memberIds.includes(u._id));
        }

        return channelUsers.filter((u) => {
            const name = (u.fullName || '').toLowerCase();
            return name.includes(query) || name.replace(' ', '').includes(query);
        });
    };

    const mentionableUsers = getMentionableUsers();

    const handleMentionSelect = (user) => {
        const isThread = mentionTargetIsThread;
        const text = isThread ? threadReply : newMessage;
        const textBeforeCursor = text.slice(0, text.lastIndexOf('@'));
        const newText = textBeforeCursor + `@${user.fullName.replace(' ', '')} `;

        if (isThread) setThreadReply(newText);
        else setNewMessage(newText);

        setMentionQuery(null);
    };

    const handleInputChange = (e, isThread = false) => {
        const val = e.target.value;
        if (isThread) setThreadReply(val);
        else setNewMessage(val);

        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';

        const cursor = e.target.selectionStart;
        const textBeforeCursor = val.slice(0, cursor);
        const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);

        if (match) {
            setMentionQuery(match[1]);
            setMentionTargetIsThread(isThread);
        } else {
            setMentionQuery(null);
        }
    };

    const loadInitialData = async () => {
        try {
            const [channelsRes, dmsRes, usersRes, mentionsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/chat/channels`, { headers }),
                axios.get(`${API_BASE_URL}/api/chat/dm`, { headers }),
                axios.get(`${API_BASE_URL}/api/chat/users`, { headers }),
                axios.get(`${API_BASE_URL}/api/chat/mentions`, { headers }),
            ]);
            setChannels(channelsRes.data);
            setDms(dmsRes.data);
            setUsers(usersRes.data);
            setMentionBadges(mentionsRes.data);

            if (!activeChannel && channelsRes.data.length > 0) {
                handleSelectChannel(
                    channelsRes.data.find((c) => c.type === 'General') || channelsRes.data[0],
                );
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    const handleSelectChannel = async (channel) => {
        setActiveChannel(channel);
        setActiveThread(null);
        setMentionBadges((prev) => ({ ...prev, [channel._id]: 0 }));
        setMentionQuery(null);

        try {
            const res = await axios.get(
                `${API_BASE_URL}/api/chat/channels/${channel._id}/messages`,
                { headers },
            );
            setMessages(res.data);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateDM = async (recipientId) => {
        try {
            const res = await axios.post(
                `${API_BASE_URL}/api/chat/dm`,
                { recipientId },
                { headers },
            );
            const dm = res.data;
            if (!dms.find((d) => d._id === dm._id)) {
                setDms([...dms, dm]);
                if (socket) socket.emit('joinChannel', dm._id);
            }
            handleSelectChannel(dm);
            setDmUserQuery('');
        } catch (err) {
            console.error(err);
        }
    };

    const handleSendMessage = async (e, isThread = false) => {
        e.preventDefault();
        const text = isThread ? threadReply : newMessage;
        const currentFile = isThread ? threadFile : file;

        if (!text.trim() && !currentFile) return;

        const formData = new FormData();
        formData.append('text', text);
        if (isThread) formData.append('threadId', activeThread._id);
        if (currentFile) formData.append('file', currentFile);

        try {
            if (isThread) {
                setThreadReply('');
                setThreadFile(null);
            } else {
                setNewMessage('');
                setFile(null);
            }

            await axios.post(
                `${API_BASE_URL}/api/chat/channels/${activeChannel._id}/messages`,
                formData,
                { headers },
            );
            setTimeout(() => {
                isThread
                    ? threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                    : messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } catch (err) {
            console.error(err);
        }
    };

    const handleOpenThread = async (message) => {
        setActiveThread(message);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/chat/messages/${message._id}/thread`, {
                headers,
            });
            setThreadMessages(res.data);
            setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch (err) {
            console.error(err);
        }
    };

    const createCustomChannel = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API_BASE_URL}/api/chat/channels`, newChannelForm, {
                headers,
            });
            setChannels([...channels, res.data]);
            if (socket) socket.emit('joinChannel', res.data._id);
            setShowChannelModal(false);
            setNewChannelForm({ name: '', description: '', members: [] });
            setChannelSearchUser('');
        } catch (err) {
            console.error(err);
        }
    };

    const addMemberToChannel = async (userId) => {
        try {
            const res = await axios.post(
                `${API_BASE_URL}/api/chat/channels/${activeChannel._id}/members`,
                { userId },
                { headers },
            );
            setActiveChannel(res.data);
            setChannels(channels.map((c) => (c._id === res.data._id ? res.data : c)));
        } catch (err) {
            console.error(err);
        }
    };

    const removeMemberFromChannel = async (userId) => {
        try {
            const res = await axios.delete(
                `${API_BASE_URL}/api/chat/channels/${activeChannel._id}/members/${userId}`,
                { headers },
            );
            setActiveChannel(res.data);
            setChannels(channels.map((c) => (c._id === res.data._id ? res.data : c)));
        } catch (err) {
            console.error(err);
        }
    };

    const formatTextWithMentions = (text) => {
        if (!text) return '';
        const mentionRegex = /@(\S+)/g;
        const parts = text.split(mentionRegex);

        if (parts.length === 1) return text;

        return text.split(' ').map((word, i) => {
            if (word.startsWith('@')) {
                return (
                    <span key={i} className="text-accent font-semibold bg-blue-50 px-1 rounded">
                        {word}{' '}
                    </span>
                );
            }
            return word + ' ';
        });
    };

    const renderFileAttachment = (msg) => {
        if (!msg.fileUrl) return null;
        const isImage = msg.fileType?.startsWith('image/');

        if (isImage) {
            return (
                <a
                    href={msg.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-2"
                >
                    <img
                        src={msg.fileUrl}
                        alt={msg.fileName}
                        className="max-w-xs max-h-48 rounded-lg border border-slate-200 hover:opacity-90"
                    />
                </a>
            );
        }

        return (
            <a
                href={msg.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 max-w-sm"
            >
                <div className="w-10 h-10 bg-primary/10 text-primary rounded flex items-center justify-center">
                    {msg.fileType?.includes('pdf') ? (
                        <FileText size={20} />
                    ) : (
                        <Paperclip size={20} />
                    )}
                </div>
                <div className="flex-1 overflow-hidden">
                    <div className="text-sm font-medium text-slate-800 truncate">
                        {msg.fileName}
                    </div>
                    <div className="text-xs text-slate-500 uppercase">Document</div>
                </div>
                <Download size={16} className="text-slate-400" />
            </a>
        );
    };

    const getDMName = (dm) => {
        const otherUser = dm.members.find((m) => m._id !== currentUser._id);
        return otherUser ? otherUser.fullName : 'Saved Messages';
    };

    return (
        <DashboardLayout>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-[calc(100vh-8rem)] flex overflow-hidden">
                {/* Sidebar */}
                <div className="w-64 border-r border-slate-200 flex flex-col bg-slate-50/50">
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {/* Channels */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Channels
                                </h3>
                                {(currentUser.role === 'Admin' ||
                                    currentUser.role === 'Manager') && (
                                    <button
                                        onClick={() => setShowChannelModal(true)}
                                        className="text-slate-400 hover:text-primary"
                                    >
                                        <Plus size={16} />
                                    </button>
                                )}
                            </div>
                            <div className="space-y-1">
                                {channels.map((channel) => (
                                    <button
                                        key={channel._id}
                                        onClick={() => handleSelectChannel(channel)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            activeChannel?._id === channel._id
                                                ? 'bg-primary text-white'
                                                : 'text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            {channel.type === 'Team' ? (
                                                <Users size={16} />
                                            ) : (
                                                <Hash size={16} />
                                            )}
                                            <span className="truncate">{channel.name}</span>
                                        </div>
                                        {mentionBadges[channel._id] > 0 && (
                                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                {mentionBadges[channel._id]}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Direct Messages */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Direct Messages
                                </h3>
                            </div>

                            <div className="mb-3 relative">
                                <input
                                    type="text"
                                    placeholder="Search user..."
                                    className="w-full text-sm px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-primary focus:outline-none"
                                    value={dmUserQuery}
                                    onChange={(e) => setDmUserQuery(e.target.value)}
                                />
                                {dmUserQuery && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-20 max-h-48 overflow-y-auto">
                                        {users
                                            .filter(
                                                (u) =>
                                                    (u.fullName || '')
                                                        .toLowerCase()
                                                        .includes(dmUserQuery.toLowerCase()) &&
                                                    u._id !== currentUser._id,
                                            )
                                            .map((u) => (
                                                <button
                                                    key={u._id}
                                                    onClick={() => handleCreateDM(u._id)}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0 truncate"
                                                >
                                                    {u.fullName}
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1">
                                {dms.map((dm) => (
                                    <button
                                        key={dm._id}
                                        onClick={() => handleSelectChannel(dm)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            activeChannel?._id === dm._id
                                                ? 'bg-primary text-white'
                                                : 'text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            <span className="truncate">{getDMName(dm)}</span>
                                        </div>
                                        {mentionBadges[dm._id] > 0 && (
                                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                {mentionBadges[dm._id]}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Chat Area */}
                {activeChannel ? (
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* Channel Header */}
                        <div className="h-14 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0 shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                    {activeChannel.type === 'DM' ? (
                                        '@'
                                    ) : activeChannel.type === 'Team' ? (
                                        <Users size={18} />
                                    ) : (
                                        <Hash size={18} />
                                    )}
                                    {activeChannel.type === 'DM'
                                        ? getDMName(activeChannel)
                                        : activeChannel.name}
                                </h2>
                                {activeChannel.description && (
                                    <span className="text-sm text-slate-500 hidden md:block border-l border-slate-300 pl-3">
                                        {activeChannel.description}
                                    </span>
                                )}
                            </div>

                            {activeChannel.type === 'Custom' &&
                                (currentUser.role === 'Admin' ||
                                    currentUser._id === activeChannel.createdBy?._id) && (
                                    <button
                                        onClick={() => setShowMembersModal(true)}
                                        className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-primary font-medium px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
                                    >
                                        <UserPlus size={16} /> Manage Members
                                    </button>
                                )}
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <MessageSquare size={48} className="mb-4 opacity-20" />
                                    <p>
                                        This is the start of the{' '}
                                        {activeChannel.type === 'DM'
                                            ? 'direct message history'
                                            : 'channel'}
                                        .
                                    </p>
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isMentioned = msg.mentions?.some(
                                        (m) => m._id === currentUser._id,
                                    );
                                    return (
                                        <div
                                            key={msg._id}
                                            className={`group flex gap-4 ${isMentioned ? 'bg-yellow-50/50 -mx-6 px-6 py-2 border-l-4 border-yellow-400' : ''}`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold shrink-0 shadow-sm">
                                                {msg.sender.fullName.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-2 mb-1">
                                                    <span className="font-semibold text-slate-900">
                                                        {msg.sender.fullName}
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        {new Date(msg.createdAt).toLocaleTimeString(
                                                            [],
                                                            { hour: '2-digit', minute: '2-digit' },
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="text-slate-700 whitespace-pre-wrap break-words">
                                                    {formatTextWithMentions(msg.text)}
                                                </div>
                                                {renderFileAttachment(msg)}

                                                {/* Threading Actions */}
                                                <div className="mt-2 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleOpenThread(msg)}
                                                        className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary bg-slate-100 px-2 py-1 rounded"
                                                    >
                                                        <MessageCircle size={14} />
                                                        {msg.replyCount > 0
                                                            ? `${msg.replyCount} replies`
                                                            : 'Reply'}
                                                    </button>
                                                </div>
                                                {/* Always show if there are replies */}
                                                {msg.replyCount > 0 && (
                                                    <div className="mt-2 group-hover:hidden flex items-center gap-1 text-xs font-medium text-primary">
                                                        <MessageCircle size={14} /> {msg.replyCount}{' '}
                                                        replies
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-slate-200">
                            {file && (
                                <div className="mb-2 flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg w-fit max-w-sm">
                                    <Paperclip size={14} className="text-slate-500" />
                                    <span className="text-sm truncate text-slate-700">
                                        {file.name}
                                    </span>
                                    <button
                                        onClick={() => setFile(null)}
                                        className="text-slate-400 hover:text-red-500 ml-2"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                            <form
                                onSubmit={(e) => handleSendMessage(e, false)}
                                className="flex items-end gap-2 bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all shadow-sm relative"
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={(e) => setFile(e.target.files[0])}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 text-slate-400 hover:text-primary rounded-full hover:bg-white transition-colors"
                                >
                                    <Plus size={20} />
                                </button>
                                {mentionQuery !== null &&
                                    !mentionTargetIsThread &&
                                    mentionableUsers.length > 0 && (
                                        <div className="absolute bottom-full left-0 w-64 mb-2 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto">
                                            {mentionableUsers.map((u) => (
                                                <button
                                                    key={u._id}
                                                    type="button"
                                                    onClick={() => handleMentionSelect(u)}
                                                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50 last:border-0"
                                                >
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">
                                                        {u.fullName.charAt(0)}
                                                    </div>
                                                    <span>{u.fullName}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                <textarea
                                    className="flex-1 bg-transparent border-0 focus:ring-0 resize-none max-h-32 min-h-[40px] py-2 text-slate-800 placeholder-slate-400"
                                    placeholder={`Message ${activeChannel.type === 'DM' ? getDMName(activeChannel) : '#' + activeChannel.name}`}
                                    rows={1}
                                    value={newMessage}
                                    onChange={(e) => handleInputChange(e, false)}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === 'Enter' &&
                                            !e.shiftKey &&
                                            mentionQuery === null
                                        ) {
                                            e.preventDefault();
                                            handleSendMessage(e, false);
                                        }
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim() && !file}
                                    className="p-2 bg-primary text-white rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors mb-0.5"
                                >
                                    <Send size={18} />
                                </button>
                            </form>
                            <div className="text-[10px] text-slate-400 text-right mt-1.5 mr-2">
                                Use @ to mention users. Max file size: 10MB
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center bg-slate-50">
                        <div className="text-center text-slate-500">
                            <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="text-lg font-medium text-slate-600">
                                Select a channel to start messaging
                            </p>
                        </div>
                    </div>
                )}

                {/* Thread Sidebar (Right) */}
                {activeThread && (
                    <div className="w-80 border-l border-slate-200 flex flex-col bg-slate-50 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">
                        <div className="h-14 border-b border-slate-200 px-4 flex items-center justify-between bg-white shrink-0">
                            <h3 className="font-semibold text-slate-800">Thread</h3>
                            <button
                                onClick={() => setActiveThread(null)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {/* Original Message */}
                            <div className="pb-4 border-b border-slate-200">
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
                                        {activeThread.sender.fullName.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="flex items-baseline gap-2 mb-1">
                                            <span className="font-semibold text-slate-900 text-sm">
                                                {activeThread.sender.fullName}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(
                                                    activeThread.createdAt,
                                                ).toLocaleTimeString([], {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </div>
                                        <div className="text-sm text-slate-700 whitespace-pre-wrap">
                                            {formatTextWithMentions(activeThread.text)}
                                        </div>
                                        {renderFileAttachment(activeThread)}
                                    </div>
                                </div>
                            </div>

                            {/* Replies */}
                            <div className="space-y-4">
                                {threadMessages.map((msg) => (
                                    <div key={msg._id} className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
                                            {msg.sender.fullName.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="flex items-baseline gap-2 mb-1">
                                                <span className="font-semibold text-slate-900 text-sm">
                                                    {msg.sender.fullName}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    {new Date(msg.createdAt).toLocaleTimeString(
                                                        [],
                                                        { hour: '2-digit', minute: '2-digit' },
                                                    )}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-700 whitespace-pre-wrap">
                                                {formatTextWithMentions(msg.text)}
                                            </div>
                                            {renderFileAttachment(msg)}
                                        </div>
                                    </div>
                                ))}
                                <div ref={threadEndRef} />
                            </div>
                        </div>

                        {/* Thread Input */}
                        <div className="p-3 bg-white border-t border-slate-200">
                            {threadFile && (
                                <div className="mb-2 flex items-center gap-2 bg-slate-100 px-2 py-1 rounded w-fit max-w-full">
                                    <Paperclip size={12} className="text-slate-500" />
                                    <span className="text-xs truncate text-slate-700">
                                        {threadFile.name}
                                    </span>
                                    <button
                                        onClick={() => setThreadFile(null)}
                                        className="text-slate-400 hover:text-red-500"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            )}
                            <form
                                onSubmit={(e) => handleSendMessage(e, true)}
                                className="flex items-end gap-2 bg-slate-50 border border-slate-300 rounded-lg p-1.5 focus-within:border-primary transition-colors relative"
                            >
                                <input
                                    type="file"
                                    ref={threadFileInputRef}
                                    className="hidden"
                                    onChange={(e) => setThreadFile(e.target.files[0])}
                                />
                                <button
                                    type="button"
                                    onClick={() => threadFileInputRef.current?.click()}
                                    className="p-1.5 text-slate-400 hover:text-primary"
                                >
                                    <Plus size={16} />
                                </button>
                                {mentionQuery !== null &&
                                    mentionTargetIsThread &&
                                    mentionableUsers.length > 0 && (
                                        <div className="absolute bottom-full left-0 w-64 mb-2 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto">
                                            {mentionableUsers.map((u) => (
                                                <button
                                                    key={u._id}
                                                    type="button"
                                                    onClick={() => handleMentionSelect(u)}
                                                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50 last:border-0"
                                                >
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">
                                                        {u.fullName.charAt(0)}
                                                    </div>
                                                    <span>{u.fullName}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                <textarea
                                    className="flex-1 bg-transparent border-0 focus:ring-0 resize-none max-h-24 min-h-[30px] py-1.5 text-sm"
                                    placeholder="Reply..."
                                    rows={1}
                                    value={threadReply}
                                    onChange={(e) => handleInputChange(e, true)}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === 'Enter' &&
                                            !e.shiftKey &&
                                            mentionQuery === null
                                        ) {
                                            e.preventDefault();
                                            handleSendMessage(e, true);
                                        }
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={!threadReply.trim() && !threadFile}
                                    className="p-1.5 text-primary hover:bg-slate-200 rounded disabled:opacity-50"
                                >
                                    <Send size={16} />
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            {/* Create Channel Modal */}
            {showChannelModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                <Plus size={20} className="text-indigo-500" /> Create New Channel
                            </h3>
                            <button
                                onClick={() => setShowChannelModal(false)}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <form
                                id="create-channel-form"
                                onSubmit={createCustomChannel}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                        Channel Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newChannelForm.name}
                                        onChange={(e) =>
                                            setNewChannelForm({
                                                ...newChannelForm,
                                                name: e.target.value,
                                            })
                                        }
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                                        required
                                        placeholder="e.g. project-alpha"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                        Description (optional)
                                    </label>
                                    <textarea
                                        value={newChannelForm.description}
                                        onChange={(e) =>
                                            setNewChannelForm({
                                                ...newChannelForm,
                                                description: e.target.value,
                                            })
                                        }
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm h-20 resize-none focus:ring-2 focus:ring-primary outline-none transition-all"
                                        placeholder="What's this channel about?"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                        Add Members
                                    </label>
                                    <input
                                        type="text"
                                        value={channelSearchUser}
                                        onChange={(e) => setChannelSearchUser(e.target.value)}
                                        placeholder="Search users..."
                                        className="w-full px-4 py-2 mb-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                                    />
                                    <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
                                        {users
                                            .filter((u) => u._id !== currentUser._id)
                                            .filter((u) =>
                                                u.fullName
                                                    .toLowerCase()
                                                    .includes(channelSearchUser.toLowerCase()),
                                            )
                                            .map((u) => {
                                                const isSelected = newChannelForm.members.includes(
                                                    u._id,
                                                );
                                                return (
                                                    <label
                                                        key={u._id}
                                                        className="flex items-center gap-3 p-2 hover:bg-slate-50 cursor-pointer transition-colors"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setNewChannelForm({
                                                                        ...newChannelForm,
                                                                        members: [
                                                                            ...newChannelForm.members,
                                                                            u._id,
                                                                        ],
                                                                    });
                                                                } else {
                                                                    setNewChannelForm({
                                                                        ...newChannelForm,
                                                                        members:
                                                                            newChannelForm.members.filter(
                                                                                (id) =>
                                                                                    id !== u._id,
                                                                            ),
                                                                    });
                                                                }
                                                            }}
                                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                                        />
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                                                                {u.fullName.charAt(0)}
                                                            </div>
                                                            <span className="text-sm font-medium text-slate-700">
                                                                {u.fullName}
                                                            </span>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowChannelModal(false)}
                                className="px-5 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="create-channel-form"
                                className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2"
                            >
                                <Check size={16} /> Create Channel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manage Members Modal */}
            {showMembersModal && activeChannel && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 text-indigo-600">
                                <Users size={20} /> Manage Members
                            </h3>
                            <button
                                onClick={() => setShowMembersModal(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                                    Current Members ({activeChannel.members.length})
                                </h4>
                                <div className="bg-slate-50/50 border border-slate-100 rounded-xl divide-y divide-slate-100">
                                    {activeChannel.members.map((member) => (
                                        <div
                                            key={member._id}
                                            className="flex items-center justify-between p-3 hover:bg-white transition-colors group"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                                    {member.fullName.charAt(0)}
                                                </div>
                                                <span className="text-sm font-medium text-slate-700">
                                                    {member.fullName}
                                                </span>
                                            </div>
                                            {member._id !== currentUser._id &&
                                                member._id !== activeChannel.createdBy?._id && (
                                                    <button
                                                        onClick={() =>
                                                            removeMemberFromChannel(member._id)
                                                        }
                                                        className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-xs font-bold uppercase tracking-tighter bg-red-50 px-2 py-1 rounded"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                                    Add Members
                                </h4>
                                <div className="bg-slate-50/50 border border-slate-100 rounded-xl divide-y divide-slate-100 max-h-48 overflow-y-auto">
                                    {users
                                        .filter(
                                            (u) =>
                                                !activeChannel.members.find((m) => m._id === u._id),
                                        )
                                        .map((user) => (
                                            <div
                                                key={user._id}
                                                className="flex items-center justify-between p-3 hover:bg-white transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
                                                        {user.fullName.charAt(0)}
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-700">
                                                        {user.fullName}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => addMemberToChannel(user._id)}
                                                    className="text-indigo-600 hover:text-indigo-700 text-xs font-bold uppercase tracking-tighter bg-indigo-50 px-3 py-1 rounded-lg transition-colors"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        ))}
                                    {users.filter(
                                        (u) => !activeChannel.members.find((m) => m._id === u._id),
                                    ).length === 0 && (
                                        <div className="p-6 text-center text-sm text-slate-400 italic">
                                            Everyone is already in the channel.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setShowMembersModal(false)}
                                className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold text-sm hover:bg-slate-900 shadow-sm transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
