classdef ReduceMeanLayer1014 < nnet.layer.Layer & nnet.layer.Formattable
    % A custom layer auto-generated while importing an ONNX network.
    %#codegen

    %#ok<*PROPLC>
    %#ok<*NBRAK>
    %#ok<*INUSL>
    %#ok<*VARARG>
    properties (Learnable)
    end

    properties (State)
    end

    properties
        Vars
        NumDims
    end

    methods(Static, Hidden)
        % Specify the properties of the class that will not be modified
        % after the first assignment.
        function p = matlabCodegenNontunableProperties(~)
            p = {
                % Constants, i.e., Vars, NumDims and all learnables and states
                'Vars'
                'NumDims'
                };
        end
    end


    methods(Static, Hidden)
        % Instantiate a codegenable layer instance from a MATLAB layer instance
        function this_cg = matlabCodegenToRedirected(mlInstance)
            this_cg = severity_net_epoch_07.coder.ReduceMeanLayer1014(mlInstance);
        end
        function this_ml = matlabCodegenFromRedirected(cgInstance)
            this_ml = severity_net_epoch_07.ReduceMeanLayer1014(cgInstance.Name);
            if isstruct(cgInstance.Vars)
                names = fieldnames(cgInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this_ml.Vars.(fieldname) = dlarray(cgInstance.Vars.(fieldname));
                end
            else
                this_ml.Vars = [];
            end
            this_ml.NumDims = cgInstance.NumDims;
        end
    end

    methods
        function this = ReduceMeanLayer1014(mlInstance)
            this.Name = mlInstance.Name;
            this.OutputNames = {'x_blocks_blocks_4_23'};
            if isstruct(mlInstance.Vars)
                names = fieldnames(mlInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this.Vars.(fieldname) = severity_net_epoch_07.coder.ops.extractIfDlarray(mlInstance.Vars.(fieldname));
                end
            else
                this.Vars = [];
            end

            this.NumDims = mlInstance.NumDims;
        end

        function [x_blocks_blocks_4_23] = predict(this, x_blocks_blocks_4_17__)
            if isdlarray(x_blocks_blocks_4_17__)
                x_blocks_blocks_4_17_ = stripdims(x_blocks_blocks_4_17__);
            else
                x_blocks_blocks_4_17_ = x_blocks_blocks_4_17__;
            end
            x_blocks_blocks_4_17NumDims = 4;
            x_blocks_blocks_4_17 = severity_net_epoch_07.coder.ops.permuteInputVar(x_blocks_blocks_4_17_, [4 3 1 2], 4);

            [x_blocks_blocks_4_23__, x_blocks_blocks_4_23NumDims__] = ReduceMeanGraph1042(this, x_blocks_blocks_4_17, x_blocks_blocks_4_17NumDims, false);
            x_blocks_blocks_4_23_ = severity_net_epoch_07.coder.ops.permuteOutputVar(x_blocks_blocks_4_23__, [3 4 2 1], 4);

            x_blocks_blocks_4_23 = dlarray(single(x_blocks_blocks_4_23_), 'SSCB');
        end

        function [x_blocks_blocks_4_23, x_blocks_blocks_4_23NumDims1044] = ReduceMeanGraph1042(this, x_blocks_blocks_4_17, x_blocks_blocks_4_17NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims1028 = severity_net_epoch_07.coder.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1043, coder.const(x_blocks_blocks_4_17NumDims));
            xReduced1029 = mean(x_blocks_blocks_4_17, dims1028);
            x_blocks_blocks_4_23 = xReduced1029;
            x_blocks_blocks_4_23NumDims = coder.const(x_blocks_blocks_4_17NumDims);

            % Set graph output arguments
            x_blocks_blocks_4_23NumDims1044 = coder.const(x_blocks_blocks_4_23NumDims);

        end

    end

end