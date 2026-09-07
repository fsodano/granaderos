// Spreadsheet-style row names continue past Z on large tactical maps.
export function tacticalGridLabel(x,y){
 let row='',n=y+1;
 while(n>0){n--;row=String.fromCharCode(65+n%26)+row;n=Math.floor(n/26);}
 return `${row}${x+1}`;
}
