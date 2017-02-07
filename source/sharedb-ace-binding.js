class sharedbAceBinding {
  constructor(session, path, doc) {
    this.session = session;
    this.path = path;
    this.doc = doc;
    this.suppress = false;
    this.setup(); 
  }

  setup() {
    const self = this;
    // Set initial data
    self.suppress = true;
    self.session.setValue(self.doc.data[self.path[0]]);
    self.suppress = false;

    self.session.on('change', self.onLocalChange.bind(self));
    
    self.doc.on('op', self.onRemoteChange.bind(self)); 
  }
  
  /**
   * @param delta - delta that ace editor produces upon changes
   * eg. {'start':{'row':5,'column':1},'end':{'row':5,'column':2},'action':'insert','lines':['d']}
   */
  deltaTransform(delta) {
    // TODO: add path 
    const aceDoc = this.session.getDocument(); 
    const op = {};
    op.p = this.path.concat(aceDoc.positionToIndex(delta.start));
    let action;
    if (delta.action === 'insert') {
      action = 'si';
    } else if (delta.action === 'remove') {
      action = 'sd';
    } else {
      throw `action ${action} not supported`;
    }
    
    const str = delta.lines.join('\n');
    op[action] = str;
    return op;
  }

  /**
   * @param op - op that sharedb returns
   * eg. [{'p':[4],'sd':'e'}]
   */
  opTransform(op) {
    const self = this;
    const index = op.p[op.p.length -1]; 
    const pos = self.session.doc.indexToPosition(pos, 0); 
    let action;
    let lines;
    if('sd' in op) {
      action = 'remove';
      lines = op.sd.split('\n');
    } else if ('si' in op) {
      action = 'insert';
      lines = op.si.split('\n');
    } else {
      throw Exception('Invalid Operation: ' + JSON.stringify(op));
    }
    
    const delta = {
      'start': pos,
      'end':{
        'row': pos.row + lines.length,
        'column': lines[lines.length - 1].length
      },
      'action': action,
      'lines': lines
    };
    return delta;
  }

  onLocalChange(delta) {
    const self = this;
    console.log(self);
    if (self.suppress) return; 
    const op = self.deltaTransform(delta);

    self.doc.submitOp(op, {source: self}, function(err) {
      if (err) throw err; 
    });
  }

  onRemoteChange(ops, source) {
    const self = this;
    if (source === self) return;
    const deltas = [];
    for (const op of ops) {
      console.log(op);
      deltas.push(self.opTransform(op));
    }
    self.suppress = true;
    self.session.getDocument().applyDeltas(deltas);
    self.suppress = false;
  }
}

export default sharedbAceBinding;