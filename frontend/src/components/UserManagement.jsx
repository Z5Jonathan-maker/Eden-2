import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { 
  Users, UserPlus, Shield, ShieldCheck, ShieldAlert, 
  Edit, Trash2, Check, X, RefreshCw
} from 'lucide-react';
import { NAV_ICONS } from '../assets/badges';

var API_URL = import.meta.env.REACT_APP_BACKEND_URL;

var ROLE_COLORS = {
  admin: 'bg-red-600',
  manager: 'bg-purple-600',
  adjuster: 'bg-blue-600',
  client: 'bg-gray-600'
};

var ROLE_ICONS = {
  admin: ShieldAlert,
  manager: ShieldCheck,
  adjuster: Shield,
  client: Users
};

function UserManagement() {
  var [users, setUsers] = useState([]);
  var [currentUserInfo, setCurrentUserInfo] = useState(null);
  var [loading, setLoading] = useState(true);
  var [showCreateForm, setShowCreateForm] = useState(false);
  var [editingUser, setEditingUser] = useState(null);
  var [formData, setFormData] = useState({ email: '', full_name: '', password: '', role: 'adjuster' });
  var [error, setError] = useState('');

  function getToken() {
    return localStorage.getItem('eden_token');
  }

  const fetchData = useCallback(function fetchData() {
    setLoading(true);
    var headers = { 'Authorization': 'Bearer ' + getToken() };
    
    Promise.all([
      fetch(API_URL + '/api/users/', { headers }),
      fetch(API_URL + '/api/users/me', { headers })
    ]).then(function(responses) {
      return Promise.all(responses.map(function(r) { 
        if (!r.ok) throw new Error('Failed to fetch');
        return r.json(); 
      }));
    }).then(function(data) {
      setUsers(data[0] || []);
      setCurrentUserInfo(data[1]);
      setLoading(false);
    }).catch(function(err) {
      setError('Failed to load users. You may not have permission.');
      setLoading(false);
    });
  }, []);

  useEffect(function() {
    fetchData();
  }, [fetchData]);

  function handleCreateUser(e) {
    e.preventDefault();
    setError('');
    
    fetch(API_URL + '/api/users/', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + getToken(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    })
    .then(function(r) {
      if (!r.ok) return r.json().then(function(d) { throw new Error(d.detail); });
      return r.json();
    })
    .then(function() {
      setShowCreateForm(false);
      setFormData({ email: '', full_name: '', password: '', role: 'adjuster' });
      fetchData();
    })
    .catch(function(err) {
      setError(err.message);
    });
  }

  function handleUpdateUser(userId, updateData) {
    fetch(API_URL + '/api/users/' + userId, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + getToken(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    })
    .then(function(r) {
      if (!r.ok) return r.json().then(function(d) { throw new Error(d.detail); });
      return r.json();
    })
    .then(function() {
      setEditingUser(null);
      fetchData();
    })
    .catch(function(err) {
      setError(err.message);
    });
  }

  function handleDeleteUser(userId) {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    fetch(API_URL + '/api/users/' + userId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
    .then(function(r) {
      if (!r.ok) return r.json().then(function(d) { throw new Error(d.detail); });
      return r.json();
    })
    .then(function() {
      fetchData();
    })
    .catch(function(err) {
      setError(err.message);
    });
  }

  function handleToggleActive(user) {
    handleUpdateUser(user.id, { is_active: !user.is_active });
  }

  function canManageUsers() {
    return currentUserInfo && currentUserInfo.permissions && 
           currentUserInfo.permissions.indexOf('users.create') !== -1;
  }

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <div className="spinner-tactical w-12 h-12"></div>
      </div>
    );
  }

  if (!canManageUsers()) {
    return (
      <div className="p-8 min-h-screen">
        <div className="card-tactical p-12 text-center">
            <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-tactical font-bold text-white mb-2">Access Denied</h3>
            <p className="text-zinc-400 font-mono">You don't have permission to manage users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 min-h-screen page-enter">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <img src={NAV_ICONS.squad} alt="Squad" className="w-10 h-10 sm:w-12 sm:h-12 object-contain icon-3d-shadow" />
          <div>
            <h1 className="text-xl sm:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange">SQUAD</h1>
            <p className="text-sm sm:text-base text-zinc-500 font-mono uppercase tracking-wider">Manage users and permissions</p>
          </div>
        </div>
        <button className="btn-tactical px-4 py-2.5 text-sm flex items-center gap-2 w-full sm:w-auto justify-center" onClick={function() { setShowCreateForm(true); }}>
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 sm:p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm font-mono">
          {error}
          <button className="float-right" onClick={function() { setError(''); }}>×</button>
        </div>
      )}

      {currentUserInfo && (
        <Card className="mb-6">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <div className="text-xs sm:text-sm text-gray-600">Logged in as:</div>
                <div className="font-medium text-sm sm:text-base truncate">{currentUserInfo.email}</div>
                <Badge className={ROLE_COLORS[currentUserInfo.role]}>{currentUserInfo.role}</Badge>
              </div>
              <div className="text-xs sm:text-sm text-gray-500">
                Permissions: {currentUserInfo.permissions ? currentUserInfo.permissions.length : 0}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New User</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={function(e) { setFormData(Object.assign({}, formData, { email: e.target.value })); }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Full Name</label>
                  <Input
                    type="text"
                    value={formData.full_name}
                    onChange={function(e) { setFormData(Object.assign({}, formData, { full_name: e.target.value })); }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={function(e) { setFormData(Object.assign({}, formData, { password: e.target.value })); }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={formData.role}
                    onChange={function(e) { setFormData(Object.assign({}, formData, { role: e.target.value })); }}
                  >
                    <option value="client">Client</option>
                    <option value="adjuster">Adjuster</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button type="submit" className="bg-orange-600 hover:bg-orange-700">Create User</Button>
                <Button type="button" variant="outline" onClick={function() { setShowCreateForm(false); }}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Users ({users.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">User</th>
                  <th className="text-left p-3 font-medium">Role</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Created</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(function(user) {
                  var RoleIcon = ROLE_ICONS[user.role] || Users;
                  var isCurrentUser = currentUserInfo && currentUserInfo.id === user.id;
                  
                  return (
                    <tr key={user.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center space-x-3">
                          <div className={'w-10 h-10 rounded-full flex items-center justify-center ' + (user.is_active ? 'bg-zinc-800' : 'bg-red-500/10')}>
                            <RoleIcon className={'w-5 h-5 ' + (user.is_active ? 'text-zinc-400' : 'text-red-400')} />
                          </div>
                          <div>
                            <div className="font-medium text-white">{user.full_name}</div>
                            <div className="text-sm text-zinc-500">{user.email}</div>
                          </div>
                          {isCurrentUser && <Badge variant="outline" className="text-xs">You</Badge>}
                        </div>
                      </td>
                      <td className="p-3">
                        {editingUser === user.id ? (
                          <select
                            className="p-1 border rounded text-sm"
                            defaultValue={user.role}
                            onChange={function(e) { handleUpdateUser(user.id, { role: e.target.value }); }}
                          >
                            <option value="client">Client</option>
                            <option value="adjuster">Adjuster</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <Badge className={ROLE_COLORS[user.role]}>{user.role}</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge className={user.is_active ? 'bg-green-600' : 'bg-red-600'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-zinc-500">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end space-x-2">
                          {editingUser === user.id ? (
                            <Button size="sm" variant="outline" onClick={function() { setEditingUser(null); }}>
                              <X className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={function() { setEditingUser(user.id); }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={function() { handleToggleActive(user); }}
                            disabled={isCurrentUser}
                          >
                            {user.is_active ? <X className="w-4 h-4 text-red-500" /> : <Check className="w-4 h-4 text-green-500" />}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={function() { handleDeleteUser(user.id); }}
                            disabled={isCurrentUser}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.keys(ROLE_COLORS).map(function(role) {
              var RoleIcon = ROLE_ICONS[role];
              return (
                <div key={role} className="p-4 border rounded-lg">
                  <div className="flex items-center space-x-2 mb-3">
                    <RoleIcon className="w-5 h-5" />
                    <span className="font-medium capitalize">{role}</span>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {role === 'admin' && (
                      <div>
                        <li>• Full system access</li>
                        <li>• User management</li>
                        <li>• Settings & integrations</li>
                        <li>• Data import/export</li>
                      </div>
                    )}
                    {role === 'manager' && (
                      <div>
                        <li>• View all claims</li>
                        <li>• Assign adjusters</li>
                        <li>• Approve settlements</li>
                        <li>• Run QA tests</li>
                      </div>
                    )}
                    {role === 'adjuster' && (
                      <div>
                        <li>• Manage assigned claims</li>
                        <li>• Create inspections</li>
                        <li>• Upload documents</li>
                        <li>• Access University</li>
                      </div>
                    )}
                    {role === 'client' && (
                      <div>
                        <li>• View own claims</li>
                        <li>• Access University</li>
                      </div>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default UserManagement;
