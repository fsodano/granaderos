// Stable minimum-cost queue. Equal-cost cells keep insertion order so replacing
// the former stable array sort cannot change route or replay decisions.
export class RouteQueue {
  constructor(first){this.heap=[];this.sequence=0;if(first)this.push(first);}
  get length(){return this.heap.length;}
  before(a,b){return a.point.cost<b.point.cost||a.point.cost===b.point.cost&&a.order<b.order;}
  push(point){
    const entry={point,order:this.sequence++},heap=this.heap;
    let index=heap.length;heap.push(entry);
    while(index){const parent=(index-1)>>1;if(!this.before(entry,heap[parent]))break;heap[index]=heap[parent];index=parent;}
    heap[index]=entry;
  }
  shift(){
    const heap=this.heap,first=heap[0];if(!first)return undefined;
    const last=heap.pop();
    if(heap.length){
      let index=0;
      while(index*2+1<heap.length){
        let child=index*2+1;
        if(child+1<heap.length&&this.before(heap[child+1],heap[child]))child++;
        if(!this.before(heap[child],last))break;
        heap[index]=heap[child];index=child;
      }
      heap[index]=last;
    }
    return first.point;
  }
}
