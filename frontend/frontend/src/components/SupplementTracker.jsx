import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { 
  FileText, Plus, DollarSign, Clock, CheckCircle, XCircle, 
  AlertCircle, ArrowLeft, Send, Trash2, Edit, ChevronDown, ChevronUp
} from 'lucide-react';
import { NAV_ICONS } from '../assets/badges';

var API_URL = process.env.REACT_APP_BACKEND_URL;

var STATUS_COLORS = {
  draft: 'bg-gray-500',
  submitted: 'bg-blue-500',
  under_review: 'bg-yellow-500',
  partial_approved: 'bg-orange-500',
  approved: 'bg-green-500',
  denied: 'bg-red-500',
  disputed: 'bg-purple-500'
};

var STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  partial_approved: 'Partial',
  approved: 'Approved',
  denied: 'Denied',
  disputed: 'Disputed'
};

function SupplementTracker() {
  var params = useParams();
  var claimId = params.claimId;
  var navigate = useNavigate();
  
  var [claim, setClaim] = useState(null);
  var [supplements, setSupplements] = useState([]);
  var [totals, setTotals] = useState({});
  var [categories, setCategories] = useState([]);
  var [loading, setLoading] = useState(true);
  var [showNewForm, setShowNewForm] = useState(false);
  var [editingSupplement, setEditingSupplement] = useState(null);
  var [expandedSupplement, setExpandedSupplement] = useState(null);
  var [newSupplement, setNewSupplement] = useState({ title: '', description: '', line_items: [] });
  var [newLineItem, setNewLineItem] = useState({ description: '', category: 'general', quantity: 1, unit: 'EA', unit_price: 0, total: 0 });

  function getToken() {
    return localStorage.getItem('eden_token');
  }

  useEffect(function() {
    fetchData();
  }, [claimId]);

  function fetchData() {
    setLoading(true);
    var headers = { 'Authorization': 'Bearer ' + getToken() };
    
    Promise.all([
      fetch(API_URL + '/api/claims/' + claimId, { headers }),
      fetch(API_URL + '/api/supplements/claim/' + claimId, { headers }),
      fetch(API_URL + '/api/supplements/categories', { headers })
    ]).then(function(responses) {
      return Promise.all(responses.map(function(r) { return r.json(); }));
    }).then(function(data) {
      setClaim(data[0]);
      setSupplements(data[1].supplements || []);
      setTotals(data[1].totals || {});
      setCategories(data[2] || []);
      setLoading(false);
    }).catch(function() {
      setLoading(false);
    });
  }

  function formatCurrency(amount) {
    return '$' + (amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function addLineItem() {
    var item = Object.assign({}, newLineItem, {
      id: Date.now().toString(),
      total: newLineItem.quantity * newLineItem.unit_price,
      carrier_approved: 0,
      variance: newLineItem.quantity * newLineItem.unit_price
    });
    setNewSupplement(Object.assign({}, newSupplement, {
      line_items: newSupplement.line_items.concat([item])
    }));
    setNewLineItem({ description: '', category: 'general', quantity: 1, unit: 'EA', unit_price: 0, total: 0 });
  }

  function removeLineItem(itemId) {
    setNewSupplement(Object.assign({}, newSupplement, {
      line_items: newSupplement.line_items.filter(function(i) { return i.id !== itemId; })
    }));
  }

  function createSupplement() {
    if (!newSupplement.title || newSupplement.line_items.length === 0) {
      alert('Please add a title and at least one line item');
      return;
    }

    fetch(API_URL + '/api/supplements/', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + getToken(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        claim_id: claimId,
        claim_number: claim ? claim.claim_number : '',
        title: newSupplement.title,
        description: newSupplement.description,
        line_items: newSupplement.line_items
      })
    })
    .then(function(r) { return r.json(); })
    .then(function() {
      setShowNewForm(false);
      setNewSupplement({ title: '', description: '', line_items: [] });
      fetchData();
    });
  }

  function submitSupplement(supplementId) {
    fetch(API_URL + '/api/supplements/' + supplementId + '/submit', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
    .then(function() { fetchData(); });
  }

  function updateSupplementStatus(supplementId, status, approvedAmount) {
    fetch(API_URL + '/api/supplements/' + supplementId, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + getToken(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        status: status,
        carrier_approved_amount: approvedAmount,
        carrier_response_date: new Date().toISOString()
      })
    })
    .then(function() { 
      setEditingSupplement(null);
      fetchData(); 
    });
  }

  function deleteSupplement(supplementId) {
    if (!window.confirm('Delete this draft supplement?')) return;
    
    fetch(API_URL + '/api/supplements/' + supplementId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
    .then(function() { fetchData(); });
  }

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={function() { navigate('/claims/' + claimId); }} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Claim
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange">SUPPLEMENT TRACKER</h1>
            {claim && <p className="text-gray-600">Claim #{claim.claim_number} - {claim.client_name}</p>}
          </div>
          <Button className="bg-orange-600 hover:bg-orange-700" onClick={function() { setShowNewForm(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            New Supplement
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-gray-900">
          <CardContent className="p-6">
            <p className="text-blue-100 text-sm">Total Requested</p>
            <p className="text-2xl font-bold">{formatCurrency(totals.total_requested)}</p>
            <p className="text-blue-200 text-xs mt-1">{totals.supplement_count || 0} supplements</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-gray-900">
          <CardContent className="p-6">
            <p className="text-green-100 text-sm">Approved</p>
            <p className="text-2xl font-bold">{formatCurrency(totals.total_approved)}</p>
            <p className="text-green-200 text-xs mt-1">{totals.approved_count || 0} approved</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-gray-900">
          <CardContent className="p-6">
            <p className="text-orange-100 text-sm">Outstanding</p>
            <p className="text-2xl font-bold">{formatCurrency(totals.total_outstanding)}</p>
            <p className="text-orange-200 text-xs mt-1">{totals.pending_count || 0} pending</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-gray-900">
          <CardContent className="p-6">
            <p className="text-purple-100 text-sm">Recovery Rate</p>
            <p className="text-2xl font-bold">
              {totals.total_requested > 0 ? Math.round((totals.total_approved / totals.total_requested) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* New Supplement Form */}
      {showNewForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Supplement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title *</label>
                  <Input
                    value={newSupplement.title}
                    onChange={function(e) { setNewSupplement(Object.assign({}, newSupplement, { title: e.target.value })); }}
                    placeholder="e.g., Supplement #1 - Hidden Roof Damage"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <Input
                    value={newSupplement.description}
                    onChange={function(e) { setNewSupplement(Object.assign({}, newSupplement, { description: e.target.value })); }}
                    placeholder="Brief description of supplement scope"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3">Line Items</h4>
                
                {newSupplement.line_items.length > 0 && (
                  <table className="w-full mb-4 text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Description</th>
                        <th className="text-left p-2">Category</th>
                        <th className="text-right p-2">Qty</th>
                        <th className="text-right p-2">Unit Price</th>
                        <th className="text-right p-2">Total</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {newSupplement.line_items.map(function(item) {
                        return (
                          <tr key={item.id} className="border-b">
                            <td className="p-2">{item.description}</td>
                            <td className="p-2">{item.category}</td>
                            <td className="p-2 text-right">{item.quantity} {item.unit}</td>
                            <td className="p-2 text-right">{formatCurrency(item.unit_price)}</td>
                            <td className="p-2 text-right font-medium">{formatCurrency(item.total)}</td>
                            <td className="p-2">
                              <Button size="sm" variant="ghost" onClick={function() { removeLineItem(item.id); }}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-50 font-bold">
                        <td colSpan="4" className="p-2 text-right">Total Requested:</td>
                        <td className="p-2 text-right">{formatCurrency(newSupplement.line_items.reduce(function(sum, i) { return sum + i.total; }, 0))}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {/* Add Line Item Form */}
                <div className="grid grid-cols-6 gap-2 items-end">
                  <div className="col-span-2">
                    <label className="block text-xs mb-1">Description</label>
                    <Input
                      value={newLineItem.description}
                      onChange={function(e) { setNewLineItem(Object.assign({}, newLineItem, { description: e.target.value })); }}
                      placeholder="Item description"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Category</label>
                    <select
                      className="w-full p-2 border rounded text-sm"
                      value={newLineItem.category}
                      onChange={function(e) { setNewLineItem(Object.assign({}, newLineItem, { category: e.target.value })); }}
                    >
                      {categories.map(function(cat) {
                        return <option key={cat.id} value={cat.id}>{cat.name}</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Qty</label>
                    <Input
                      type="number"
                      value={newLineItem.quantity}
                      onChange={function(e) { setNewLineItem(Object.assign({}, newLineItem, { quantity: parseFloat(e.target.value) || 0 })); }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Unit Price</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newLineItem.unit_price}
                      onChange={function(e) { setNewLineItem(Object.assign({}, newLineItem, { unit_price: parseFloat(e.target.value) || 0 })); }}
                    />
                  </div>
                  <div>
                    <Button onClick={addLineItem} disabled={!newLineItem.description}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button className="bg-orange-600 hover:bg-orange-700" onClick={createSupplement}>
                  Create Supplement
                </Button>
                <Button variant="outline" onClick={function() { setShowNewForm(false); }}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Supplements List */}
      <div className="space-y-4">
        {supplements.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Supplements Yet</h3>
              <p className="text-gray-600 mb-4">Create your first supplement to start tracking additional claim amounts.</p>
              <Button className="bg-orange-600 hover:bg-orange-700" onClick={function() { setShowNewForm(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Supplement
              </Button>
            </CardContent>
          </Card>
        ) : (
          supplements.map(function(supp) {
            var isExpanded = expandedSupplement === supp.id;
            return (
              <Card key={supp.id}>
                <CardContent className="p-0">
                  {/* Header Row */}
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={function() { setExpandedSupplement(isExpanded ? null : supp.id); }}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <span className="text-orange-600 font-bold">#{supp.supplement_number}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold">{supp.title}</h3>
                        <p className="text-sm text-gray-500">{supp.line_items ? supp.line_items.length : 0} line items</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(supp.total_requested)}</p>
                        {supp.carrier_approved_amount > 0 && (
                          <p className="text-sm text-green-600">Approved: {formatCurrency(supp.carrier_approved_amount)}</p>
                        )}
                      </div>
                      <Badge className={STATUS_COLORS[supp.status]}>{STATUS_LABELS[supp.status]}</Badge>
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t p-4 bg-gray-50">
                      {/* Line Items Table */}
                      {supp.line_items && supp.line_items.length > 0 && (
                        <table className="w-full text-sm mb-4">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Description</th>
                              <th className="text-left p-2">Category</th>
                              <th className="text-right p-2">Qty</th>
                              <th className="text-right p-2">Unit Price</th>
                              <th className="text-right p-2">Requested</th>
                              <th className="text-right p-2">Approved</th>
                              <th className="text-right p-2">Variance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {supp.line_items.map(function(item) {
                              var variance = item.total - (item.carrier_approved || 0);
                              return (
                                <tr key={item.id} className="border-b">
                                  <td className="p-2">{item.description}</td>
                                  <td className="p-2">{item.category}</td>
                                  <td className="p-2 text-right">{item.quantity} {item.unit}</td>
                                  <td className="p-2 text-right">{formatCurrency(item.unit_price)}</td>
                                  <td className="p-2 text-right">{formatCurrency(item.total)}</td>
                                  <td className="p-2 text-right text-green-600">{formatCurrency(item.carrier_approved || 0)}</td>
                                  <td className={'p-2 text-right ' + (variance > 0 ? 'text-red-600' : 'text-green-600')}>
                                    {formatCurrency(variance)}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-white font-bold">
                              <td colSpan="4" className="p-2 text-right">Totals:</td>
                              <td className="p-2 text-right">{formatCurrency(supp.total_requested)}</td>
                              <td className="p-2 text-right text-green-600">{formatCurrency(supp.carrier_approved_amount)}</td>
                              <td className="p-2 text-right text-red-600">{formatCurrency(supp.variance || supp.total_requested - supp.carrier_approved_amount)}</td>
                            </tr>
                          </tbody>
                        </table>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                          {supp.submitted_at && <span>Submitted: {new Date(supp.submitted_at).toLocaleDateString()}</span>}
                          {supp.carrier_response_date && <span className="ml-4">Response: {new Date(supp.carrier_response_date).toLocaleDateString()}</span>}
                        </div>
                        <div className="flex space-x-2">
                          {supp.status === 'draft' && (
                            <>
                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={function(e) { e.stopPropagation(); submitSupplement(supp.id); }}>
                                <Send className="w-4 h-4 mr-1" />
                                Submit to Carrier
                              </Button>
                              <Button size="sm" variant="outline" onClick={function(e) { e.stopPropagation(); deleteSupplement(supp.id); }}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </>
                          )}
                          {supp.status === 'submitted' && (
                            <Button size="sm" variant="outline" onClick={function(e) { e.stopPropagation(); updateSupplementStatus(supp.id, 'under_review', 0); }}>
                              Mark Under Review
                            </Button>
                          )}
                          {(supp.status === 'under_review' || supp.status === 'submitted') && (
                            <>
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={function(e) { 
                                e.stopPropagation(); 
                                var amount = prompt('Enter approved amount:', supp.total_requested);
                                if (amount) updateSupplementStatus(supp.id, 'approved', parseFloat(amount));
                              }}>
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approved
                              </Button>
                              <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={function(e) { 
                                e.stopPropagation(); 
                                var amount = prompt('Enter partial approved amount:', '0');
                                if (amount) updateSupplementStatus(supp.id, 'partial_approved', parseFloat(amount));
                              }}>
                                Partial
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600" onClick={function(e) { e.stopPropagation(); updateSupplementStatus(supp.id, 'denied', 0); }}>
                                <XCircle className="w-4 h-4 mr-1" />
                                Denied
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

export default SupplementTracker;
